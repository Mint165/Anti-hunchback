import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { useMediaQuery } from 'react-responsive';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { useAlertEngine } from '../services/useAlertEngine';
import { analyzePosture, calculateHealthScore, type PostureMetrics, type CalibrationData, type CameraMode, type Landmark } from '../services/postureAI';
import { loadCalibration, loadSettings, addPetXP, getUserIdSync } from '../services/db';
import { broadcastFatigueAlert, subscribeToParentMessage, subscribeToAuxCameraLandmarks } from '../services/parentSync';
import { subscribePresence, trackPresence } from '../services/presence';
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
  const presenceAnnouncedRef = useRef<boolean>(false);

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

  // Task 6d: subscribe to aux-camera landmarks from a second device.
  // We expire the aux data after 5s of silence so the merge doesn't keep
  // using stale landmarks after the aux device goes offline.
  useEffect(() => {
    const userId = getUserIdSync();
    const unsubscribe = subscribeToAuxCameraLandmarks((deviceId, pose) => {
      if (deviceId === ownDeviceIdRef.current) return; // ignore self
      setAuxCameraDeviceId(deviceId);
      setAuxPoseLandmarks(pose);
      auxLastSeenRef.current = Date.now();
    }, userId);
    const expiry = setInterval(() => {
      if (auxLastSeenRef.current && Date.now() - auxLastSeenRef.current > 5000) {
        setAuxPoseLandmarks(null);
        setAuxCameraDeviceId(null);
        auxLastSeenRef.current = 0;
      }
    }, 2000);
    return () => {
      unsubscribe();
      clearInterval(expiry);
    };
  }, []);

  // Keep a ref so the analyze loop below can read aux landmarks without
  // re-running the effect on every aux update (which would be very noisy).
  const auxPoseRef = useRef<Landmark[] | null>(null);
  useEffect(() => { auxPoseRef.current = auxPoseLandmarks; }, [auxPoseLandmarks]);

  // Task F: announce this device on the user's presence channel + subscribe
  // to presence updates from other devices. The announcement is done once
  // per mount; the subscription stays live for the lifetime of the provider.
  // We re-announce whenever isDesktop flips (rare; e.g. user rotates a
  // hybrid device) so the phone/desktop flag stays accurate.
  useEffect(() => {
    const userId = getUserIdSync();
    if (!userId) return;
    // Announce (and re-announce) our presence state.
    trackPresence({
      deviceId: ownDeviceIdRef.current,
      role: 'student',
      isDesktop,
      isAux: false, // the desktop is never the aux; the phone sets this when it starts its camera
    }).catch((e) => console.warn('[presence] track failed', e));
    presenceAnnouncedRef.current = true;

    const unsubscribe = subscribePresence(
      userId,
      ownDeviceIdRef.current,
      (others) => setOtherActiveDevices(others)
    );
    return () => {
      unsubscribe();
    };
  }, [isDesktop]);

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

    const calculatedMetrics = analyzePosture(
      poseLandmarks,
      faceLandmarks,
      calibration,
      640,
      480,
      movementHistoryRef.current,
      cameraMode,
      isManualWritingMode
    );

    // Task 6d: merge aux-camera analysis. The aux device (e.g. a side-angled
    // phone) is better at detecting lateral shoulder tilt and rotation than
    // the front camera, so when an aux view is live and reports a HIGHER
    // shoulderTilt than the front camera, trust the aux value. We deliberately
    // keep this conservative — the front camera stays authoritative for eye
    // distance, neck angle, and slouch (which the front view measures more
    // reliably). This is a "prefer aux when it sees worse" merge, not a full
    // replacement of the primary AI.
    const auxPose = auxPoseRef.current;
    if (auxPose && auxPose.length > 12) {
      const auxMetrics = analyzePosture(
        auxPose,
        null, // aux device may not stream face landmarks; we don't merge eye data
        calibration,
        640,
        480,
        [], // movement history isn't tracked for the aux view; pass empty
        'side',
        isManualWritingMode
      );
      if (auxMetrics.shoulderTilt > calculatedMetrics.shoulderTilt + 2) {
        calculatedMetrics.shoulderTilt = auxMetrics.shoulderTilt;
      }
      // If aux sees a markedly worse slouch angle, surface it too —
      // side views catch forward hunching the front camera can miss.
      if (auxMetrics.slouchAngle > calculatedMetrics.slouchAngle + 3) {
        calculatedMetrics.slouchAngle = auxMetrics.slouchAngle;
      }
    }

    setMetrics(calculatedMetrics);
    setHealthScore(calculateHealthScore(calculatedMetrics));

  }, [poseLandmarks, faceLandmarks, isModelReady, calibration, cameraMode, isManualWritingMode]);

  // Keep a ref to latest metrics to avoid reading via setState callback
  const metricsRef = useRef<PostureMetrics | null>(null);
  useEffect(() => { metricsRef.current = metrics; }, [metrics]);

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
      otherActiveDevices,
      ownDeviceId: ownDeviceIdRef.current,
      isDesktop
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
  otherActiveDevices: [],
  ownDeviceId: '',
  isDesktop: false,
};

export const usePostureContext = () => {
  const context = useContext(PostureContext);
  // Return the null-shaped default when called outside a provider
  // (i.e. from a parent-only render path) instead of throwing —
  // throwing would force every parent component to be wrapped or
  // refactored, and the parent flow genuinely doesn't need posture.
  return context ?? NULL_POSTURE_CONTEXT;
};
