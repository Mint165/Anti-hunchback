import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { useAlertEngine } from '../services/useAlertEngine';
import { analyzePosture, calculateHealthScore, type PostureMetrics, type CalibrationData } from '../services/postureAI';
import { loadCalibration, loadSettings, addPetXP } from '../services/db';
import { broadcastFatigueAlert, subscribeToParentMessage } from '../services/parentSync';
import { voiceService } from '../services/voiceService';

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
}

const PostureContext = createContext<PostureContextType | undefined>(undefined);

export const PostureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { poseLandmarks, faceLandmarks, isLoading, error, startCamera, stopCamera, isModelReady } = useMediaPipe();
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [metrics, setMetrics] = useState<PostureMetrics | null>(null);
  const [healthScore, setHealthScore] = useState<number>(100);
  const [goodPostureStreak, setGoodPostureStreak] = useState<number>(0);

  const { alertLevel, startSession, resetBreak, hasStarted } = useAlertEngine(metrics?.state || 'GOOD_POSTURE');
  
  const movementHistoryRef = useRef<{ x: number; y: number }[]>([]);

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

  // Subscribe to parent messages
  useEffect(() => {
    const unsubscribe = subscribeToParentMessage((text) => {
      setLatestParentMessage(text);
      voiceService.speak(text, () => {
        // Clear message after speaking (optional, or keep it on screen for a bit)
        setTimeout(() => setLatestParentMessage(null), 5000);
      });
    });
    return () => unsubscribe();
  }, []);

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
    }
    return () => stopCamera();
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
      movementHistoryRef.current
    );

    setMetrics(calculatedMetrics);
    setHealthScore(calculateHealthScore(calculatedMetrics));

  }, [poseLandmarks, faceLandmarks, isModelReady, calibration]);

  // --- Global 1-second tick for Eye Exercise timer, Fatigue buffer, Pet XP, Angle accumulation ---
  useEffect(() => {
    if (!hasStarted) return;
    const settings = loadSettings();
    const eyeExerciseIntervalMs = settings.eyeExerciseInterval * 60 * 1000; // 20 min default
    const fatigueCheckIntervalMs = 5 * 60 * 1000; // 5 minutes

    const interval = setInterval(() => {
      const now = Date.now();

      // --- Eye Exercise 20-20-20 trigger ---
      if (!eyeExerciseTriggered) {
        const timeSinceLastExercise = now - (lastEyeExerciseTimeRef.current || sessionStartTimeRef.current);
        if (timeSinceLastExercise >= eyeExerciseIntervalMs) {
          setEyeExerciseTriggered(true);
        }
      }

      // --- Fatigue screening buffer ---
      setMetrics(prevMetrics => {
        if (!prevMetrics) return prevMetrics;

        // Accumulate blink and fidget data
        fatigueBufferRef.current.sampleCount += 1;
        if (prevMetrics.isBlinking) {
          fatigueBufferRef.current.blinkTicks += 1;
        }
        fatigueBufferRef.current.fidgetSum += prevMetrics.fidgetFactor;

        // Accumulate angle data for session analytics
        setSessionAngleAccumulator(prev => ({
          shoulderTiltSum: prev.shoulderTiltSum + prevMetrics.shoulderTilt,
          neckAngleSum: prev.neckAngleSum + prevMetrics.neckAngle,
          slouchAngleSum: prev.slouchAngleSum + prevMetrics.slouchAngle,
          tickCount: prev.tickCount + 1,
        }));

        // Check every 5 minutes
        const timeSinceLastFatigueCheck = now - (lastFatigueCheckRef.current || sessionStartTimeRef.current);
        if (timeSinceLastFatigueCheck >= fatigueCheckIntervalMs && fatigueBufferRef.current.sampleCount > 0) {
          const avgBlinksPerMinute = (fatigueBufferRef.current.blinkTicks / fatigueBufferRef.current.sampleCount) * 60;
          const avgFidget = fatigueBufferRef.current.fidgetSum / fatigueBufferRef.current.sampleCount;

          if (avgBlinksPerMinute < 4 || avgFidget > 35) {
            setSessionFatigueFlags(f => f + 1);
            if (avgBlinksPerMinute < 4) {
              broadcastFatigueAlert("Tần suất chớp mắt của bé quá thấp trong 5 phút qua, có dấu hiệu mỏi mắt.");
            }
            if (avgFidget > 35) {
              broadcastFatigueAlert("Bé nhấp nhổm nhiều trong 5 phút qua, có dấu hiệu mất tập trung hoặc mệt mỏi.");
            }
          }

          // Reset buffer
          fatigueBufferRef.current = { blinkTicks: 0, fidgetSum: 0, sampleCount: 0 };
          lastFatigueCheckRef.current = now;
        }

        // Pet XP logic
        if (prevMetrics.state === 'GOOD_POSTURE' || prevMetrics.state === 'WRITING') {
          setGoodPostureStreak(s => {
            const newStreak = s + 1;
            if (newStreak % 60 === 0) {
              addPetXP(10);
            }
            return newStreak;
          });
        } else if (prevMetrics.state === 'BAD_POSTURE') {
          setGoodPostureStreak(0);
        }

        return prevMetrics;
      });
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
    }}>
      <video
        id="global-webcam"
        ref={videoRef}
        style={{ display: 'none' }}
        autoPlay
        playsInline
        muted
      />
      {children}
    </PostureContext.Provider>
  );
};

export const usePostureContext = () => {
  const context = useContext(PostureContext);
  if (context === undefined) {
    throw new Error('usePostureContext must be used within a PostureProvider');
  }
  return context;
};
