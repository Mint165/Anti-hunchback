// useAuxCamera — Task F (phone-side aux camera)
//
// Lightweight hook for the phone acting as the auxiliary side-view
// camera. Differences vs the primary useMediaPipe:
//   • Pose-only (no FaceMesh — the side view doesn't need iris tracking)
//   • Raw getUserMedia with facingMode:'environment' (rear camera)
//   • requestAnimationFrame loop instead of @mediapipe/camera utility
//   • Calls broadcastAuxCameraLandmarks() directly inside onResults so
//     we never round-trip through React state for the broadcast path
//   • Tracks broadcast FPS for the mini-stats UI
//
// Why a separate hook rather than reusing useMediaPipe:
//   1. The phone needs rear camera; the desktop's front-camera
//      instance stays untouched on its own video element.
//   2. Pose-only halves the model load on a phone (FaceMesh is ~3 MB).
//   3. The desktop never broadcasts landmarks — its hook shouldn't
//      carry that code path.

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Landmark } from '../services/postureAI';
import { broadcastAuxCameraLandmarks } from '../services/parentSync';
import { getUserIdSync } from '../services/db';

declare global {
  interface Window {
    Pose: any;
  }
}

type FacingMode = 'environment' | 'user';

interface UseAuxCameraResult {
  isLoading: boolean;
  error: string | null;
  isModelReady: boolean;
  isStreaming: boolean;
  /** Landmarks per second broadcast over the past 1s window. */
  broadcastFps: number;
  /** Currently active camera face. 'environment' = rear, 'user' = front. */
  facingMode: FacingMode;
  startCamera: (videoElement: HTMLVideoElement) => void;
  stopCamera: () => void;
  /** Flip between rear and front cameras. No-op if not streaming. */
  switchFacingMode: () => Promise<void>;
}

export function useAuxCamera(deviceId: string): UseAuxCameraResult {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModelReady, setIsModelReady] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [broadcastFps, setBroadcastFps] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<FacingMode>('environment');

  const poseRef = useRef<any>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSendRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number | null>(null);
  // Mirror of facingMode for use inside async callbacks / rAF loop where
  // reading state would either capture a stale closure or force a
  // re-subscription. Updated in lockstep with the state.
  const facingModeRef = useRef<FacingMode>('environment');

  // Stop the aux camera: cancel the rAF loop, stop MediaStream tracks,
  // release the video element. Idempotent — safe to call multiple times.
  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      streamRef.current = null;
    }
    if (videoElementRef.current) {
      try { videoElementRef.current.srcObject = null; } catch {}
    }
    videoElementRef.current = null;
    setIsStreaming(false);
  }, []);

  // Initialize Pose model on mount.
  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        let retries = 0;
        while (!window.Pose && retries < 50) {
          await new Promise((r) => setTimeout(r, 200));
          retries++;
        }
        if (!window.Pose) {
          throw new Error('MediaPipe Pose could not be loaded from CDN.');
        }
        if (!active) return;

        const pose = new window.Pose({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });
        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        pose.onResults((results: any) => {
          if (!active) return;
          const lms = results.poseLandmarks as Landmark[] | null;
          if (!lms) return;
          // Broadcast immediately — do NOT route through React state,
          // we want the desktop to see this frame as fast as possible.
          // Pass getUserIdSync() so the landmarks land on the user's
          // scoped channel instead of the legacy global one.
          broadcastAuxCameraLandmarks(deviceId, lms, null, getUserIdSync());
          // Tick the FPS counter; the 1s window timer flushes it.
          frameCountRef.current += 1;
        });

        poseRef.current = pose;
        setIsModelReady(true);
        setIsLoading(false);
      } catch (err: any) {
        console.error('[auxCamera] init failed', err);
        if (active) {
          setError(err?.message || 'Failed to load Pose model');
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      active = false;
      stopCamera();
      if (poseRef.current) {
        try { poseRef.current.close(); } catch {}
        poseRef.current = null;
      }
      if (fpsTimerRef.current !== null) {
        clearInterval(fpsTimerRef.current);
        fpsTimerRef.current = null;
      }
    };
  }, [deviceId, stopCamera]);

  // 1-second window FPS reporter. Started when streaming starts,
  // stopped when streaming stops. Reads & resets frameCountRef.
  const startFpsTimer = useCallback(() => {
    if (fpsTimerRef.current !== null) return;
    fpsTimerRef.current = window.setInterval(() => {
      setBroadcastFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000) as unknown as number;
  }, []);
  const stopFpsTimer = useCallback(() => {
    if (fpsTimerRef.current !== null) {
      clearInterval(fpsTimerRef.current);
      fpsTimerRef.current = null;
      setBroadcastFps(0);
      frameCountRef.current = 0;
    }
  }, []);

  // Internal helper: (re)acquire a MediaStream for the currently
  // selected facingMode, attach it to the video element, and kick off
  // the rAF inference loop. Used by both startCamera (initial start)
  // and switchFacingMode (flip). Returns true on success.
  const acquireStream = useCallback(async (videoElement: HTMLVideoElement): Promise<boolean> => {
    const face = facingModeRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: face }, width: 640, height: 480 },
        audio: false,
      });
      if (!videoElementRef.current) {
        // User stopped before we got the stream.
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      streamRef.current = stream;
      videoElement.srcObject = stream;
      // Play with a 2s readiness guard — if play() rejects OR the
      // readyState doesn't reach HAVE_CURRENT_DATA within 2s, surface
      // a real error instead of silently degrading to a stuck frame.
      try {
        await videoElement.play();
      } catch (e: any) {
        console.error('[auxCamera] video.play() rejected', e);
        setError('camera_playback_failed');
        setIsStreaming(false);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        return false;
      }
      await new Promise<void>((resolve) => {
        const started = Date.now();
        const checkReady = () => {
          if (videoElement.readyState >= 2) return resolve();
          if (Date.now() - started > 2000) {
            console.error('[auxCamera] readyState stuck at', videoElement.readyState);
            setError('camera_playback_failed');
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
      if (videoElement.readyState < 2) {
        // Guard above already set the error; bail out so the rAF loop
        // doesn't spin against a stalled video.
        return false;
      }
      setIsStreaming(true);
      startFpsTimer();

      // 2) rAF inference loop. Throttle to ~10 FPS so a phone
      //    doesn't melt its battery; the desktop only needs
      //    landmark updates often enough to catch slouch onset.
      const loop = async () => {
        if (!videoElementRef.current || !poseRef.current) return;
        const now = performance.now();
        if (now - lastSendRef.current >= 100 && videoElementRef.current.readyState >= 2) {
          lastSendRef.current = now;
          try {
            await poseRef.current.send({ image: videoElementRef.current });
          } catch (e) {
            console.error('[auxCamera] pose.send failed', e);
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
      return true;
    } catch (err: any) {
      console.error('[auxCamera] getUserMedia failed', err);
      setError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied'
          : face === 'environment'
            ? 'Could not access rear camera'
            : 'Could not access front camera'
      );
      setIsStreaming(false);
      return false;
    }
  }, [startFpsTimer]);

  const startCamera = useCallback(
    (videoElement: HTMLVideoElement) => {
      if (!isModelReady || !poseRef.current) {
        console.warn('[auxCamera] Pose model not ready yet');
        return;
      }
      setError(null);
      videoElementRef.current = videoElement;
      void acquireStream(videoElement);
    },
    [isModelReady, acquireStream]
  );

  // Flip between rear ('environment') and front ('user') cameras.
  // Stops the current tracks, requests a new stream with the opposite
  // facingMode, and resumes the inference loop on the same video
  // element. No-op if not currently streaming.
  const switchFacingMode = useCallback(async () => {
    if (!isStreaming || !videoElementRef.current) return;
    const next: FacingMode = facingModeRef.current === 'environment' ? 'user' : 'environment';
    // Stop current tracks + cancel the rAF loop so we don't send a
    // frame from the old stream mid-flip.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch {} });
      streamRef.current = null;
    }
    facingModeRef.current = next;
    setFacingMode(next);
    setError(null);
    await acquireStream(videoElementRef.current);
  }, [isStreaming, acquireStream]);

  // Wrap stopCamera to also kill the FPS timer.
  const stop = useCallback(() => {
    stopCamera();
    stopFpsTimer();
  }, [stopCamera, stopFpsTimer]);

  return {
    isLoading,
    error,
    isModelReady,
    isStreaming,
    broadcastFps,
    facingMode,
    startCamera,
    stopCamera: stop,
    switchFacingMode,
  };
}
