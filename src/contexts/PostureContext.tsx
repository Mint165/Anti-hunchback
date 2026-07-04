import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { useAlertEngine } from '../services/useAlertEngine';
import { analyzePosture, calculateHealthScore, type PostureMetrics, type CalibrationData } from '../services/postureAI';
import { loadCalibration, addPetXP } from '../services/db';

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

  // Pet XP Logic
  useEffect(() => {
    if (!hasStarted) return;
    const interval = setInterval(() => {
      // Access latest state using a setter function to avoid stale closures if metrics was a dependency
      setMetrics(prevMetrics => {
        if (!prevMetrics) return prevMetrics;
        if (prevMetrics.state === 'GOOD_POSTURE' || prevMetrics.state === 'WRITING') {
          setGoodPostureStreak(s => {
            const newStreak = s + 1;
            if (newStreak % 60 === 0) {
              // Add 10 XP every 60 seconds
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
  }, [hasStarted]);

  return (
    <PostureContext.Provider value={{
      metrics, healthScore, alertLevel, hasStarted, startSession, resetBreak,
      isModelReady, isLoading, error, calibration, setCalibration, goodPostureStreak,
      poseLandmarks, faceLandmarks
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
