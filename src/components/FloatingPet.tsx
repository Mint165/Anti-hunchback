import React, { useState, useEffect, useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { usePostureContext } from '../contexts/PostureContext';
import OliverPet, { type PetState } from './OliverPet';
import { loadUserStats } from '../services/db';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';
import styles from './FloatingPet.module.css';

export const FloatingPet: React.FC = () => {
  const { metrics, hasStarted, alertLevel } = usePostureContext();
  const [isMinimized, setIsMinimized] = useState(false);
  const [stats, setStats] = useState(() => loadUserStats());
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Refresh stats only when tab becomes visible (instead of polling every 2s)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setStats(loadUserStats());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    // Also refresh every 30 seconds (instead of 2s) as a fallback
    const interval = setInterval(() => setStats(loadUserStats()), 30000);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  if (!hasStarted) {
    return null; // Do not show floating pet if session hasn't started globally
  }

  const getPetState = (): PetState => {
    if (!hasStarted) return 'sleep';
    if (alertLevel === 'BREAK_TIME' || alertLevel === 'STRONG_WARNING') return 'tired';
    if (metrics?.isWritingMode) return 'writing';
    if (metrics && metrics.eyeDistanceCm < 50) return 'close';
    if (metrics && (metrics.slouchAngle > 15 || metrics.shoulderTilt > 7)) return 'slouch';
    if (metrics && metrics.neckAngle > 20 && !metrics.isWritingMode) return 'tired'; // head tilt
    if (metrics?.state === 'GOOD_POSTURE') return 'good';
    return 'good';
  };

  const state = getPetState();
  const isDanger = state === 'slouch' || state === 'close' || state === 'tired';

  // Mobile: keep simple fixed positioning (no drag — would conflict with page scroll)
  const bottomClass = isMobile ? 'bottom-24' : 'bottom-6';
  const rightClass = isMobile ? 'right-4' : 'right-6';

  if (isMinimized || isMobile) {
    return (
      <motion.div
        className={`fixed ${bottomClass} ${rightClass} z-50 ${styles.minimized} ${isDanger ? styles.danger : ''}`}
        onClick={() => !isMobile && setIsMinimized(false)}
        style={{ width: '60px', height: '60px' }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className={styles.petInner}>
          <OliverPet state={state} size={150} petLevel={stats.petLevel} equippedItems={stats.equippedItems} hideBubble={true} hideBadge={true} lowDetail />
        </div>
        {isDanger && (
          <div className={styles.dangerBadge}>!</div>
        )}
        {!isMobile && !isDanger && (
          <div className={styles.expandBtn}>
            <Maximize2 size={10} />
          </div>
        )}
      </motion.div>
    );
  }

  // Desktop expanded: draggable via framer-motion. Drag handle = the pet canvas
  // so the user can still click the minimize button without initiating a drag.
  return (
    <>
      <div ref={constraintsRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: -1 }} />
      <motion.div
        className={`fixed ${bottomClass} ${rightClass} z-50 ${styles.expanded} ${isDanger ? styles.alertBounce : ''}`}
        drag
        dragControls={dragControls}
        dragConstraints={constraintsRef}
        dragElastic={0.4}
        dragMomentum={false}
        dragListener={false}
      >
        <div className="relative group">
          <button
            onClick={() => setIsMinimized(true)}
            className={styles.minimizeBtn}
            aria-label="Thu nhỏ thú cưng"
          >
            <Minimize2 size={14} />
          </button>
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className={styles.scaledPet}
            style={{ cursor: 'grab' }}
          >
            <OliverPet state={state} size={180} petLevel={stats.petLevel} equippedItems={stats.equippedItems} lowDetail />
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default FloatingPet;