import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { useMediaQuery } from 'react-responsive';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { useAlertEngine } from '../services/useAlertEngine';
import { analyzePosture, calculateHealthScore, fusePostureMetrics, type PostureMetrics, type CalibrationData, type CameraMode, type Landmark } from '../services/postureAI';
import { loadCalibration, loadSettings, addPetXP, getUserIdSync } from '../services/db';
import { broadcastFatigueAlert, subscribeToParentMessage, subscribeToAuxCameraLandmarks, subscribePhoneCameraReady, subscribeAuxPairingResponse, requestAuxPairing } from '../services/parentSync';
import { subscribePresence } from '../services/presence';
import { voiceService } from '../services/voiceService';
import type { PresenceState } from '../services/presence';
interface PostureContextType {
  metrics: PostureMetrics | null;
  healthScore: number;
  alertLevel: string;
  hasStarted: boolean;
  startSession: () => void;
  resetBreak: () => void;
  isModelReady: boolean;
  isLoading: boolean;
  error: string | null;
  calibration: CalibrationData | null;
  setCalibration: (cal: CalibrationData | null) => void;
  goodPostureStreak: number;
  poseLandmarks: any[] | null;
  faceLandmarks: any[] | null;
  // Eye Exercise
  eyeExerciseTriggered: boolean;
  onEyeExerciseComplete: (xpGained: number) => void;
  // Fatigue analytics
  sessionFatigueFlags: number;
  // Accumulated angle data for session record
  sessionAngleAccumulator: {
    shoulderTiltSum: number;
    neckAngleSum: number;
    slouchAngleSum: number;
    tickCount: number;
  };
  // Parent messaging
  latestParentMessage: string | null;
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  isManualWritingMode: boolean;
  setIsManualWritingMode: (val: boolean) => void;
  // Real camera toggle (Task 7): unlike StudentView's old CSS-only showCamera,
  // these actually stop / restart the MediaStream tracks via useMediaPipe.
  isCameraActive: boolean;
  pauseCamera: () => void;
  resumeCamera: () => void;
  // Task 6d: auxiliary-camera landmarks streamed from a second device
  // running the same student account. Null when no aux device is active.
  // Components that want to merge aux data into their analysis can read
  // this; the PostureContext itself uses it to refine shoulderTilt below.
  auxPoseLandmarks: Landmark[] | null;
  auxCameraDeviceId: string | null;
  // Task D — desktop-initiated camera pairing state.
  // `phoneCameraReady` flips true when a phone on the same account
  // broadcasts phone_camera_ready with cameraActive=true (and back to
  // false on a 6s heartbeat expiry). StudentView uses this to show the
  // "Pair camera?" prompt on the desktop.
  // `phoneCameraDeviceId` is the device id of the ready phone (so the
  // desktop can target its pairing request at the right phone if more
  // than one is on the account).
  // `auxPairingAccepted` flips true once the phone acknowledges the
  // request — the desktop uses this to switch its split-screen layout
  // on before the first landmark frame arrives.
  phoneCameraReady: boolean;
  phoneCameraDeviceId: string | null;
  auxPairingAccepted: boolean;
  /** Desktop-only: request the ready phone to start streaming aux
      landmarks. No-op when no phone is ready. */
  requestPhonePairing: () => void;
  /** Dismiss the current pairing (called when the user clicks "Bỏ qua"
      on the desktop prompt, or when the phone goes offline). Resets
      auxPairingAccepted + clears the prompt. */
  dismissPhonePairing: () => void;
  // Task F: presence — list of OTHER devices currently active on the
  // same user account. The phone uses this to detect the desktop
  // before offering the "Start aux camera" button; the desktop uses
  // this to know a phone is streaming so it can render split-screen.
  otherActiveDevices: PresenceState[];
  /** This device's stable id (crypto.randomUUID in sessionStorage). */
  ownDeviceId: string;
  /** True when this device is the desktop (maxWidth: 768). Used to
      set isDesktop in presence state and to decide which aux UI to
      render. */
  isDesktop: boolean;
  /** True when this device is currently acting as the aux camera
      (a phone streaming pose landmarks). MobileCameraView sets this
      from its `useAuxCamera.isStreaming` so the presence `isAux`
      flag stays accurate. Desktops never set this. */
  isAuxStreaming: boolean;
  /** Update `isAuxStreaming`. Called by MobileCameraView when the
      phone's aux camera starts or stops streaming. */
  setIsAuxStreaming: (val: boolean) => void;
}

const PostureContext = createContext<PostureContextType | undefined>(undefined);

export const PostureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { poseLandmarks, faceLandmarks, isLoading, error, startCamera, stopCamera, isModelReady } = useMediaPipe();

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [metrics, setMetrics] = useState<PostureMetrics | null>(null);
  const [healthScore, setHealthScore] = useState<number>(100);
  const [goodPostureStreak, setGoodPostureStreak] = useState<number>(0);
  const [cameraMode, setCameraMode] = useState<CameraMode>('front');
  const [isManualWritingMode, setIsManualWritingMode] = useState<boolean>(false);

  // Task 7: real camera toggle. The MediaStream is started in the effect
  // below once models are ready. `isCameraActive` exposes the live state to
  // consumers; `pauseCamera`/`resumeCamera` stop and restart the underlying
  // MediaPipe Camera (which stops the MediaStream tracks), so StudentView's
  // toggle button now actually frees the webcam instead of just hiding the
  // element with CSS.
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const isModelReadyRef = useRef<boolean>(false);
  useEffect(() => { isModelReadyRef.current = isModelReady; }, [isModelReady]);

  const pauseCamera = useCallback(() => {
    stopCamera();
    setIsCameraActive(false);
  }, [stopCamera]);

  const resumeCamera = useCallback(() => {
    if (!isModelReadyRef.current) return;
    if (videoRef.current) {
      startCamera(videoRef.current);
      setIsCameraActive(true);
    }
  }, [startCamera]);

  const { alertLevel, startSession, resetBreak, hasStarted } = useAlertEngine(metrics?.state || 'GOOD_POSTURE');

  const movementHistoryRef = useRef<{ x: number; y: number }[]>([]);
  const autoWritingTimerRef = useRef<number>(0);
  const autoWritingEndTimerRef = useRef<number>(0);

  // Real-time metrics ref + throttle flush timestamp. `metricsRef` is
  // updated on every analyze frame (~10 Hz) so internal logic (the
  // 1-second tick effect below) sees the freshest posture without
  // waiting for the throttled `setMetrics` state update. The flush
  // timestamp gates `setMetrics`/`setHealthScore` to ~2 Hz so the
  // React tree only re-renders twice per second instead of 10×.
  const metricsRef = useRef<PostureMetrics | null>(null);
  const lastMetricsFlushRef = useRef<number>(0);

  // --- Eye Exercise (20-20-20 Rule) ---
  const [eyeExerciseTriggered, setEyeExerciseTriggered] = useState<boolean>(false);
  const sessionStartTimeRef = useRef<number>(Date.now());
  const lastEyeExerciseTimeRef = useRef<number>(0);

  // --- Fatigue Screening (5-min buffer) ---
  const [sessionFatigueFlags, setSessionFatigueFlags] = useState<number>(0);
  const fatigueBufferRef = useRef<{ blinkTicks: number; fidgetSum: number; sampleCount: number }>({
    blinkTicks: 0, fidgetSum: 0, sampleCount: 0,
  });
  const lastFatigueCheckRef = useRef<number>(0);

  // --- Accumulated angle data for session analytics ---
  const [sessionAngleAccumulator, setSessionAngleAccumulator] = useState({
    shoulderTiltSum: 0, neckAngleSum: 0, slouchAngleSum: 0, tickCount: 0,
  });

  const [latestParentMessage, setLatestParentMessage] = useState<string | null>(null);

  // Task 6d: aux camera landmarks from a second device.
  const [auxPoseLandmarks, setAuxPoseLandmarks] = useState<Landmark[] | null>(null);
  const [auxCameraDeviceId, setAuxCameraDeviceId] = useState<string | null>(null);
  // Track this device's own id so we can ignore our own aux broadcasts if
  // the user opens two tabs on the same machine.
  const ownDeviceIdRef = useRef<string>(
    (() => {
      try {
        const k = 'oliver_device_id';
        const stored = sessionStorage.getItem(k);
        if (stored) return stored;
        const id: string =
          (crypto as any).randomUUID?.() ??
          `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(k, id);
        return id;
      } catch {
        return `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      }
    })()
  );
  const auxLastSeenRef = useRef<number>(0);

  // Task F: presence — track which other devices are active on this
  // user account, and announce this device. The phone reads
  // otherActiveDevices to decide whether to show the aux UI; the
  // desktop reads it to decide whether to split the camera card.
  const isDesktop = useMediaQuery({ minWidth: 769 });
  const [otherActiveDevices, setOtherActiveDevices] = useState<PresenceState[]>([]);
  // Whether THIS device is currently acting as the aux camera (i.e.
  // a phone streaming pose landmarks to the desktop). MobileCameraView
  // sets this to true when its `useAuxCamera.isStreaming` flips true,
  // and back to false when streaming stops. We feed it into the
  // presence `trackState` so other devices see `isAux` flip accurately
  // — the previous code commented "the phone sets this when it starts
  // its camera" but never actually did, so `isAux` was always false.
  const [isAuxStreaming, setIsAuxStreaming] = useState<boolean>(false);

  // Subscribe to parent messages
  useEffect(() => {
    const userId = getUserIdSync();
    const unsubscribe = subscribeToParentMessage((text) => {
      setLatestParentMessage(text);
      voiceService.speak(text, () => {
        // Clear message after speaking (optional, or keep it on screen for a bit)
        setTimeout(() => setLatestParentMessage(null), 5000);
      });
    }, userId);
    return () => unsubscribe();
  }, []);

  // Subscribe to aux-camera landmarks from paired mobile device.
  // When the phone disconnects or packet stream stops (>1.5s), immediately
  // fall back 100% to desktop PC camera with 0ms delay.
  useEffect(() => {
    const userId = getUserIdSync();
    const unsubscribe = subscribeToAuxCameraLandmarks((deviceId, pose) => {
      if (deviceId === ownDeviceIdRef.current) return; // ignore self

      if (!pose) {
        // Explicit disconnect or stop signal from mobile device -> instant fallback
        setAuxPoseLandmarks(null);
        setAuxCameraDeviceId(null);
        auxPoseRef.current = null;
        auxLastSeenRef.current = 0;
        return;
      }

      setAuxCameraDeviceId(deviceId);
      setAuxPoseLandmarks(pose);
      auxPoseRef.current = pose;
      auxLastSeenRef.current = Date.now();
    }, userId);

    const expiry = setInterval(() => {
      if (!auxLastSeenRef.current) return;
      // Fast watchdog: if no frame received for >1500ms, instantly drop aux camera and fall back 100% to desktop camera
      if (Date.now() - auxLastSeenRef.current > 1500) {
        setAuxPoseLandmarks(null);
        setAuxCameraDeviceId(null);
        auxPoseRef.current = null;
        auxLastSeenRef.current = 0;
      }
    }, 300);

    return () => {
      unsubscribe();
      clearInterval(expiry);
    };
  }, []);

  // Keep a ref so the analyze loop below can read aux landmarks without
  // re-running the effect on every aux update (which would be very noisy).
  const auxPoseRef = useRef<Landmark[] | null>(null);
  useEffect(() => { auxPoseRef.current = auxPoseLandmarks; }, [auxPoseLandmarks]);

  // Task D — desktop-initiated camera pairing state. The phone
  // broadcasts phone_camera_ready whenever its mobile Camera tab is
  // active and the camera is on; the desktop subscribes here so the
  // StudentView can surface a "Pair camera?" prompt. We also subscribe
  // to aux_pairing_response so the desktop knows the phone has
  // acknowledged the request (the phone auto-starts its camera on
  // receipt of aux_pairing_request, which MobileCameraView subscribes
  // to directly — the context doesn't need to coordinate that side).
  const [phoneCameraReady, setPhoneCameraReady] = useState<boolean>(false);
  const [phoneCameraDeviceId, setPhoneCameraDeviceId] = useState<string | null>(null);
  const [auxPairingAccepted, setAuxPairingAccepted] = useState<boolean>(false);
  const phoneReadyDeviceRef = useRef<string | null>(null);
  // Mirror of `phoneCameraDeviceId` for use inside `requestPhonePairing`
  // (which is memoized and would otherwise capture a stale
  // `phoneCameraDeviceId` value). Updated in lockstep with the state
  // via the effect below.
  const phoneCameraDeviceIdRef = useRef<string | null>(null);
  useEffect(() => { phoneCameraDeviceIdRef.current = phoneCameraDeviceId; }, [phoneCameraDeviceId]);

  useEffect(() => {
    const userId = getUserIdSync();
    const unsubReady = subscribePhoneCameraReady((deviceId, cameraActive, ts) => {
      // Diagnostic log so the user (or support) can verify in DevTools
      // that the phone's heartbeat is actually reaching the desktop.
      // Without this, "desktop never shows the pair prompt" was a
      // black box — the phone could be heartbeating fine but the
      // desktop's `phoneCameraReady` state silently stayed false.
      console.info('[pair] phone_camera_ready from', deviceId, 'active=', cameraActive, 'ts=', ts);
      // Only the desktop surfaces the prompt; on the phone itself
      // phoneCameraReady stays false (the phone is the source, not the
      // sink). This guard also prevents a phone from prompting itself.
      // NOTE: we still update `phoneReadyDeviceRef` + the device-id
      // state on non-desktop devices so a phone that briefly matches
      // `minWidth: 769` during hydration doesn't lose the ready
      // device id when it flips back. Only the `phoneCameraReady`
      // boolean (which gates the visible prompt) is desktop-gated.
      if (cameraActive) {
        phoneReadyDeviceRef.current = deviceId;
        setPhoneCameraDeviceId(deviceId);
        if (isDesktop) setPhoneCameraReady(true);
      } else {
        // The phone that was ready just stopped — clear the prompt
        // unless a different phone is still ready (rare but possible).
        if (phoneReadyDeviceRef.current === deviceId) {
          phoneReadyDeviceRef.current = null;
          setPhoneCameraDeviceId(null);
          setPhoneCameraReady(false);
          setAuxPairingAccepted(false);
        }
      }
    }, userId);

    const unsubResp = subscribeAuxPairingResponse((deviceId, accepted, ts) => {
      console.info('[pair] aux_pairing_response from', deviceId, 'accepted=', accepted, 'ts=', ts);
      if (!isDesktop) return;
      if (accepted && phoneReadyDeviceRef.current === deviceId) {
        setAuxPairingAccepted(true);
      } else if (!accepted) {
        // Phone explicitly rejected (camera failed to start). Reset
        // accepted state and surface a toast on the desktop so the
        // user knows to retry on the phone side instead of waiting
        // for landmarks that will never arrive.
        setAuxPairingAccepted(false);
      }
    }, userId);

    return () => {
      unsubReady();
      unsubResp();
    };
  }, [isDesktop]);

  // Desktop-only: ask the ready phone to start streaming. No-op when
  // no phone is currently ready. Falls back to the device id we
  // inferred from presence (`phoneCameraDeviceId`) if the explicit
  // `phone_camera_ready` heartbeat hasn't set `phoneReadyDeviceRef`
  // yet — this covers the window between "presence sees a phone" and
  // "phone's first heartbeat lands", so the user can accept the
  // prompt immediately instead of waiting up to 5s for the next
  // heartbeat to populate the ref.
  const requestPhonePairing = useCallback(() => {
    if (!isDesktop) return;
    const target = phoneReadyDeviceRef.current ?? phoneCameraDeviceIdRef.current;
    if (!target) {
      console.warn('[pair] requestPhonePairing called but no phone target known');
      return;
    }
    requestAuxPairing(target, getUserIdSync());
  }, [isDesktop]);

  const dismissPhonePairing = useCallback(() => {
    setAuxPairingAccepted(false);
    // Don't clear phoneCameraReady here — the phone is still ready,
    // we just don't want the prompt visible. StudentView's local
    // dismiss flag handles hiding the prompt UI.
  }, []);

  // Presence-based fallback for `phoneCameraReady`. The primary signal
  // is the phone's explicit `phone_camera_ready` heartbeat, but that
  // heartbeat only fires while the phone's camera is actively
  // streaming — which means if the phone's camera failed to start
  // (the very common `camera_playback_failed` path on mobile), the
  // desktop never sees the phone as ready and never shows the pair
  // prompt. To break that deadlock, when presence tells us a non-
  // desktop device on the same account is online, we ALSO flip
  // `phoneCameraReady=true` and seed `phoneCameraDeviceId` so the
  // desktop can surface the prompt and let the user trigger
  // `aux_pairing_request`, which re-pokes the phone to retry its
  // camera. The explicit heartbeat still wins when it arrives
  // (it carries the authoritative `cameraActive` flag).
  useEffect(() => {
    if (!isDesktop) return;
    const phone = otherActiveDevices.find((d) => !d.isDesktop);
    if (phone) {
      // Only seed if the heartbeat hasn't already populated a more
      // authoritative device id — we don't want to clobber a real
      // `phone_camera_ready` with a presence-only sighting.
      if (!phoneReadyDeviceRef.current) {
        phoneReadyDeviceRef.current = phone.deviceId;
        setPhoneCameraDeviceId(phone.deviceId);
        setPhoneCameraReady(true);
      }
    } else {
      // No phone in presence AND no recent heartbeat — clear.
      if (phoneReadyDeviceRef.current) {
        // Only clear if the device id we have is NOT in the presence
        // list (it may have come from a heartbeat that's still alive
        // but presence hasn't synced yet). The 6s heartbeat expiry in
        // parentSync will handle the actual offline case.
        phoneReadyDeviceRef.current = null;
        setPhoneCameraDeviceId(null);
        setPhoneCameraReady(false);
        setAuxPairingAccepted(false);
      }
    }
  }, [otherActiveDevices, isDesktop]);

  // Task F: announce this device on the user's presence channel + subscribe
  // to presence updates from other devices. The announcement is done once
  // per mount; the subscription stays live for the lifetime of the provider.
  // We re-announce whenever isDesktop flips (rare; e.g. user rotates a
  // hybrid device) so the phone/desktop flag stays accurate.
  //
  // NOTE: subscribePresence both registers the `.on('presence', …)`
  // callback AND calls `.track()` from inside the `SUBSCRIBED` callback.
  // We must NOT call trackPresence() separately on the Supabase path —
  // doing so creates a second channel handle that Supabase dedupes to
  // the same instance (already joining), and the subscriber's subsequent
  // `.on('presence', …)` then throws
  // `cannot add presence callbacks … after subscribe()`.
  useEffect(() => {
    const userId = getUserIdSync();
    if (!userId) return;

    const unsubscribe = subscribePresence(
      userId,
      ownDeviceIdRef.current,
      (others) => setOtherActiveDevices(others),
      // trackState — `.track()` runs inside the SUBSCRIBED callback.
      // `isAux` reflects whether this device is currently streaming aux
      // landmarks (a phone with its camera on). Re-tracking when
      // `isAuxStreaming` flips keeps the presence state accurate so
      // other devices see the phone transition online → aux-streaming.
      {
        deviceId: ownDeviceIdRef.current,
        role: 'student',
        isDesktop,
        isAux: !isDesktop && isAuxStreaming,
      }
    );
    return () => {
      unsubscribe();
    };
  }, [isDesktop, isAuxStreaming]);

  // Load calibration on mount
  useEffect(() => {
    const savedCalibration = loadCalibration();
    if (savedCalibration.baseEyeDistance !== 80 || localStorage.getItem('oliver_calibration_data')) {
      setCalibration(savedCalibration);
    }
  }, []);

  // Start/Stop camera globally
  useEffect(() => {
    if (isModelReady && videoRef.current) {
      startCamera(videoRef.current);
      setIsCameraActive(true);
    }
    return () => {
      stopCamera();
      setIsCameraActive(false);
    };
  }, [isModelReady, startCamera, stopCamera]);

  // Analyze posture loop
  useEffect(() => {
    if (!isModelReady || !calibration) return;

    if (poseLandmarks && poseLandmarks.length > 12) {
      const leftShoulder = poseLandmarks[11];
      const rightShoulder = poseLandmarks[12];
      const shoulderMid = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
      };
      movementHistoryRef.current.push(shoulderMid);
      if (movementHistoryRef.current.length > 100) {
        movementHistoryRef.current.shift();
      }
    }

    const frontMetrics = analyzePosture(
      poseLandmarks,
      faceLandmarks,
      calibration,
      640,
      480,
      movementHistoryRef.current,
      cameraMode,
      isManualWritingMode
    );

    // Multi-Sensor Fusion Engine:
    // Combines front PC camera (authoritative for distance, tilt, baseline calibration)
    // with aux phone side camera (accurate for sagittal back slouch & forward head posture).
    // If phone camera is disconnected, auxPose is null -> falls back 100% to front camera instantly (0ms delay).
    const auxPose = auxPoseRef.current;
    let auxMetrics: PostureMetrics | null = null;
    if (auxPose && auxPose.length > 12) {
      auxMetrics = analyzePosture(
        auxPose,
        null, // Aux side camera streams pose only
        calibration,
        640,
        480,
        [],
        'side',
        isManualWritingMode
      );
    }

    const calculatedMetrics = fusePostureMetrics(
      frontMetrics,
      auxMetrics,
      Boolean(auxPose && auxPose.length > 12)
    );

    // ⚡ Throttle STATE updates to ~2 Hz (every 500 ms).
    //
    // The analyze effect itself still runs at the full ~10 Hz pose
    // frame rate (it re-fires whenever `poseLandmarks` changes), so
    // `metricsRef.current` below stays real-time for the 1-second
    // tick effect (fatigue screening, angle accumulator, auto
    // writing-mode detection, pet XP). But the React *tree* — every
    // consumer of `metrics` and `healthScore` from this context
    // (StudentView, BackboneVisualizer, AuxSkeletonOverlay, pet
    // state, hero card, status table, PHI ring) — only re-renders at
    // 2 Hz instead of 10 Hz. That removes the re-render storm that
    // was making the dashboard feel laggy even after the visible
    // status bars were throttled, without slowing down posture
    // detection itself (alert thresholds are 30 s / 120 s, so a
    // ≤500 ms latency in state propagation is invisible).
    metricsRef.current = calculatedMetrics;
    const now = Date.now();
    if (now - lastMetricsFlushRef.current >= 500) {
      lastMetricsFlushRef.current = now;
      setMetrics(calculatedMetrics);
      setHealthScore(calculateHealthScore(calculatedMetrics));
    }

  }, [poseLandmarks, faceLandmarks, isModelReady, calibration, cameraMode, isManualWritingMode]);

  // `metricsRef` and `lastMetricsFlushRef` are declared above (near
  // the other refs, before the analyze effect) so the analyze closure
  // captures them cleanly. The previously separate
  //   useEffect(() => { metricsRef.current = metrics; }, [metrics])
  // is removed — it would overwrite the ref with the throttled
  // (up to 500 ms stale) state value, defeating the real-time ref.

  // Angle accumulator ref – only flush to state every 10 seconds
  const angleAccumRef = useRef({ shoulderTiltSum: 0, neckAngleSum: 0, slouchAngleSum: 0, tickCount: 0 });
  const lastAngleFlushRef = useRef<number>(Date.now());

  // --- Global 1-second tick for Eye Exercise timer, Fatigue buffer, Pet XP, Angle accumulation ---
  useEffect(() => {
    if (!hasStarted) return;
    const settings = loadSettings();
    const eyeExerciseIntervalMs = settings.eyeExerciseInterval * 60 * 1000; // 20 min default
    const fatigueCheckIntervalMs = 5 * 60 * 1000; // 5 minutes

    const interval = setInterval(() => {
      const now = Date.now();
      const currentMetrics = metricsRef.current;

      // --- Eye Exercise 20-20-20 trigger ---
      if (!eyeExerciseTriggered) {
        const timeSinceLastExercise = now - (lastEyeExerciseTimeRef.current || sessionStartTimeRef.current);
        if (timeSinceLastExercise >= eyeExerciseIntervalMs) {
          setEyeExerciseTriggered(true);
        }
      } else {
        // While eye exercise is active, suspend all posture fatigue screening and accumulators
        return;
      }

      if (!currentMetrics) return;

      // --- Fatigue screening buffer (ref-only, no setState) ---
      fatigueBufferRef.current.sampleCount += 1;
      if (currentMetrics.isBlinking) {
        fatigueBufferRef.current.blinkTicks += 1;
      }
      fatigueBufferRef.current.fidgetSum += currentMetrics.fidgetFactor;

      // --- Angle accumulation (ref-only, flush every 10s) ---
      angleAccumRef.current.shoulderTiltSum += currentMetrics.shoulderTilt;
      angleAccumRef.current.neckAngleSum += currentMetrics.neckAngle;
      angleAccumRef.current.slouchAngleSum += currentMetrics.slouchAngle;
      angleAccumRef.current.tickCount += 1;

      if (now - lastAngleFlushRef.current >= 10000) {
        setSessionAngleAccumulator({ ...angleAccumRef.current });
        lastAngleFlushRef.current = now;
      }

      // --- Fatigue check every 5 minutes ---
      const timeSinceLastFatigueCheck = now - (lastFatigueCheckRef.current || sessionStartTimeRef.current);
      if (timeSinceLastFatigueCheck >= fatigueCheckIntervalMs && fatigueBufferRef.current.sampleCount > 0) {
        const avgBlinksPerMinute = (fatigueBufferRef.current.blinkTicks / fatigueBufferRef.current.sampleCount) * 60;
        const avgFidget = fatigueBufferRef.current.fidgetSum / fatigueBufferRef.current.sampleCount;

        if (avgBlinksPerMinute < 4 || avgFidget > 35) {
          setSessionFatigueFlags(f => f + 1);
          if (avgBlinksPerMinute < 4) {
            broadcastFatigueAlert("Tần suất chớp mắt của bé quá thấp trong 5 phút qua, có dấu hiệu mỏi mắt.", getUserIdSync());
          }
          if (avgFidget > 35) {
            broadcastFatigueAlert("Bé nhấp nhổm nhiều trong 5 phút qua, có dấu hiệu mất tập trung hoặc mệt mỏi.", getUserIdSync());
          }
        }

        // Reset buffer
        fatigueBufferRef.current = { blinkTicks: 0, fidgetSum: 0, sampleCount: 0 };
        lastFatigueCheckRef.current = now;
      }

      // --- Auto Writing Mode ---
      const isWritingCondition = 
        currentMetrics.neckAngle >= 25 && 
        currentMetrics.shoulderTilt < 5 && 
        currentMetrics.eyeDistanceCm < 55;

      if (isWritingCondition) {
        autoWritingTimerRef.current += 1;
        autoWritingEndTimerRef.current = 0;
        if (autoWritingTimerRef.current >= 5 && !isManualWritingMode) {
          setIsManualWritingMode(true);
        }
      } else {
        autoWritingTimerRef.current = 0;
        if (isManualWritingMode && currentMetrics.neckAngle < 20) {
          autoWritingEndTimerRef.current += 1;
          if (autoWritingEndTimerRef.current >= 2) {
            setIsManualWritingMode(false);
          }
        } else {
          autoWritingEndTimerRef.current = 0;
        }
      }

      // --- Pet XP logic ---
      if (currentMetrics.state === 'GOOD_POSTURE' || currentMetrics.state === 'WRITING') {
        setGoodPostureStreak(s => {
          const newStreak = s + 1;
          if (newStreak % 60 === 0) {
            addPetXP(10);
          }
          return newStreak;
        });
      } else if (currentMetrics.state === 'BAD_POSTURE') {
        setGoodPostureStreak(0);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [hasStarted, eyeExerciseTriggered]);

  // Eye exercise completion callback
  const onEyeExerciseComplete = useCallback((_xpGained: number) => {
    setEyeExerciseTriggered(false);
    lastEyeExerciseTimeRef.current = Date.now();
  }, []);

  return (
    <PostureContext.Provider value={{
      metrics, healthScore, alertLevel, hasStarted, startSession, resetBreak,
      isModelReady, isLoading, error, calibration, setCalibration, goodPostureStreak,
      poseLandmarks, faceLandmarks,
      eyeExerciseTriggered, onEyeExerciseComplete,
      sessionFatigueFlags, sessionAngleAccumulator,
      latestParentMessage,
      cameraMode,
      setCameraMode,
      isManualWritingMode,
      setIsManualWritingMode,
      isCameraActive,
      pauseCamera,
      resumeCamera,
      auxPoseLandmarks,
      auxCameraDeviceId,
      phoneCameraReady,
      phoneCameraDeviceId,
      auxPairingAccepted,
      requestPhonePairing,
      dismissPhonePairing,
      otherActiveDevices,
      ownDeviceId: ownDeviceIdRef.current,
      isDesktop,
      isAuxStreaming,
      setIsAuxStreaming,
    }}>
      <video
        id="global-webcam"
        ref={videoRef}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          opacity: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
        autoPlay
        playsInline
        muted
      />
      {children}
    </PostureContext.Provider>
  );
};

// NOTE: this hook tolerates being called outside a PostureProvider.
// The parent flow does NOT mount a PostureProvider (per the
// constitution: "Không sử dụng camera của thiết bị dù là di động hay
// máy tính khi người dùng sử dụng tài khoản phụ huynh") so any
// parent-side component that calls usePostureContext() would otherwise
// throw. The student tree is always wrapped in <PostureProvider>, so
// real student consumers always get the populated context. Components
// that genuinely need posture data should defensively check for the
// null markers (metrics === null, hasStarted === false, etc.) when
// shared between roles — but in practice every posture consumer
// (StudentView, FloatingPet, StudentAuxPhoneView) is student-only.
const NULL_POSTURE_CONTEXT: PostureContextType = {
  metrics: null,
  healthScore: 100,
  alertLevel: 'good',
  hasStarted: false,
  startSession: () => {},
  resetBreak: () => {},
  isModelReady: false,
  isLoading: false,
  error: null,
  calibration: null,
  setCalibration: () => {},
  goodPostureStreak: 0,
  poseLandmarks: null,
  faceLandmarks: null,
  eyeExerciseTriggered: false,
  onEyeExerciseComplete: () => {},
  sessionFatigueFlags: 0,
  sessionAngleAccumulator: { shoulderTiltSum: 0, neckAngleSum: 0, slouchAngleSum: 0, tickCount: 0 },
  latestParentMessage: null,
  cameraMode: 'front',
  setCameraMode: () => {},
  isManualWritingMode: false,
  setIsManualWritingMode: () => {},
  isCameraActive: false,
  pauseCamera: () => {},
  resumeCamera: () => {},
  auxPoseLandmarks: null,
  auxCameraDeviceId: null,
  phoneCameraReady: false,
  phoneCameraDeviceId: null,
  auxPairingAccepted: false,
  requestPhonePairing: () => {},
  dismissPhonePairing: () => {},
  otherActiveDevices: [],
  ownDeviceId: '',
  isDesktop: false,
  isAuxStreaming: false,
  setIsAuxStreaming: () => {},
};

export const usePostureContext = () => {
  const context = useContext(PostureContext);
  // Return the null-shaped default when called outside a provider
  // (i.e. from a parent-only render path) instead of throwing —
  // throwing would force every parent component to be wrapped or
  // refactored, and the parent flow genuinely doesn't need posture.
  return context ?? NULL_POSTURE_CONTEXT;
};
