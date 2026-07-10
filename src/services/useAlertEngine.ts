import { useState, useEffect, useRef } from 'react';
import type { PostureState } from './postureAI';

export type AlertLevel = 'NONE' | 'MILD_WARNING' | 'STRONG_WARNING' | 'BREAK_TIME';

export function useAlertEngine(currentState: PostureState) {
  const [alertLevel, setAlertLevel] = useState<AlertLevel>('NONE');
  
  const badPostureTimer = useRef(0);
  const sessionTimer = useRef(0);
  const lastTick = useRef(Date.now());
  const [hasStarted, setHasStarted] = useState(false);

  // Expose a method to "start" the session which allows audio/vibration and starts tracking
  const startSession = () => {
    setHasStarted(true);
    lastTick.current = Date.now();
  };

  useEffect(() => {
    if (!hasStarted) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTick.current) / 1000; // in seconds
      lastTick.current = now;

      sessionTimer.current += delta;

      if (currentState === 'BAD_POSTURE') {
        badPostureTimer.current += delta;
      } else if (currentState === 'GOOD_POSTURE' || currentState === 'WRITING') {
        // Reset or decay bad posture timer
        badPostureTimer.current = 0;
      }

      // Determine new alert level
      const savedDelay = parseInt(localStorage.getItem('oliver_alert_delay') || '120', 10);
      const mildDelay = Math.max(5, Math.floor(savedDelay / 4));

      if (sessionTimer.current >= 45 * 60) {
        setAlertLevel('BREAK_TIME');
      } else if (badPostureTimer.current >= savedDelay) { 
        setAlertLevel('STRONG_WARNING');
      } else if (badPostureTimer.current >= mildDelay) { 
        setAlertLevel('MILD_WARNING');
      } else {
        setAlertLevel('NONE');
      }

    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [currentState, hasStarted]);

  const resetBreak = () => {
    sessionTimer.current = 0;
    badPostureTimer.current = 0;
    lastTick.current = Date.now();
    setAlertLevel('NONE');
  };

  return { alertLevel, startSession, resetBreak, hasStarted };
}
