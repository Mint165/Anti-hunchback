// Custom hook for managing MediaPipe Pose & FaceMesh lifecycle and webcam frames

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Landmark } from '../services/postureAI';

// Declare types for window object properties
declare global {
  interface Window {
    Pose: any;
    FaceMesh: any;
    Camera: any;
  }
}

interface UseMediaPipeResult {
  poseLandmarks: Landmark[] | null;
  faceLandmarks: Landmark[] | null;
  isLoading: boolean;
  error: string | null;
  startCamera: (videoElement: HTMLVideoElement) => void;
  stopCamera: () => void;
  isModelReady: boolean;
}

export function useMediaPipe(): UseMediaPipeResult {
  const [poseLandmarks, setPoseLandmarks] = useState<Landmark[] | null>(null);
  const [faceLandmarks, setFaceLandmarks] = useState<Landmark[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModelReady, setIsModelReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const poseRef = useRef<any>(null);
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // Clean up existing camera and models
  const stopCamera = useCallback(() => {
    if (cameraRef.current) {
      try {
        cameraRef.current.stop();
      } catch (e) {
        console.error('Error stopping camera:', e);
      }
      cameraRef.current = null;
    }
    videoElementRef.current = null;
  }, []);

  // Initialize MediaPipe Pose and FaceMesh
  useEffect(() => {
    let active = true;

    const initializeModels = async () => {
      try {
        // Wait until CDN scripts are loaded on window
        let retries = 0;
        while ((!window.Pose || !window.FaceMesh || !window.Camera) && retries < 50) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          retries++;
        }

        if (!window.Pose || !window.FaceMesh || !window.Camera) {
          throw new Error('MediaPipe libraries could not be loaded from CDN. Please check network connection.');
        }

        if (!active) return;

        // 1. Initialize Pose Model
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
          if (results.poseLandmarks) {
            setPoseLandmarks(results.poseLandmarks);
          }
        });

        // 2. Initialize FaceMesh Model
        const faceMesh = new window.FaceMesh({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });
        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true, // EXTREMELY IMPORTANT: Exposes 468-477 iris landmarks
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results: any) => {
          if (!active) return;
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            setFaceLandmarks(results.multiFaceLandmarks[0]);
          }
        });

        poseRef.current = pose;
        faceMeshRef.current = faceMesh;

        setIsModelReady(true);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Failed to initialize MediaPipe models:', err);
        if (active) {
          setError(err.message || 'Lỗi tải mô hình AI');
          setIsLoading(false);
        }
      }
    };

    initializeModels();

    return () => {
      active = false;
      stopCamera();
      // Clean up models
      if (poseRef.current) {
        try { poseRef.current.close(); } catch {}
      }
      if (faceMeshRef.current) {
        try { faceMeshRef.current.close(); } catch {}
      }
    };
  }, [stopCamera]);

  // Start webcam and send frames to models (throttled to 10 FPS to save CPU)
  const startCamera = useCallback(
    (videoElement: HTMLVideoElement) => {
      if (!isModelReady || !poseRef.current || !faceMeshRef.current) {
        console.warn('AI Models are not ready yet.');
        return;
      }

      videoElementRef.current = videoElement;
      
      if (cameraRef.current) {
        cameraRef.current.stop();
      }

      let lastProcessedTime = 0;

      const camera = new window.Camera(videoElement, {
        onFrame: async () => {
          if (!videoElementRef.current) return;
          
          const now = performance.now();
          // Throttling: Run AI inference only once every 300ms (~3 FPS)
          // This significantly reduces CPU usage and React re-renders
          if (now - lastProcessedTime < 300) {
            return;
          }
          lastProcessedTime = now;

          try {
            if (poseRef.current) {
              await poseRef.current.send({ image: videoElement });
            }
            if (faceMeshRef.current) {
              await faceMeshRef.current.send({ image: videoElement });
            }
          } catch (e) {
            console.error('Error sending frame to MediaPipe:', e);
          }
        },
        width: 640,
        height: 480,
      });

      cameraRef.current = camera;
      camera.start().catch((err: any) => {
        console.error('Webcam initialization failed:', err);
        setError('Không thể truy cập Webcam. Vui lòng cho phép quyền sử dụng camera.');
      });
    },
    [isModelReady]
  );

  return {
    poseLandmarks,
    faceLandmarks,
    isLoading,
    error,
    startCamera,
    stopCamera,
    isModelReady,
  };
}
