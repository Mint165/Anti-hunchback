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

  // Refresh stats when tab becomes visible or when PetShop equips an item
  useEffect(() => {
    const refresh = () => setStats(loadUserStats());
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    // Listen to localStorage changes — fired when PetShop equips items
    const handleStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('oliver_')) refresh();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('storage', handleStorage);
    // Safety-net refresh every 30s
    const interval = setInterval(refresh, 30000);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  if (!hasStarted) {
    return null;
  }

  const getPetState = (): PetState => {
    if (!hasStarted) return 'sleep';
    if (alertLevel === 'BREAK_TIME' || alertLevel === 'STRONG_WARNING') return 'tired';
    if (metrics?.isWritingMode) return 'writing';
    if (metrics && metrics.eyeDistanceCm < 50) return 'close';
    if (metrics && (metrics.slouchAngle > 15 || metrics.shoulderTilt > 7)) return 'slouch';
    if (metrics && metrics.neckAngle > 20 && !metrics.isWritingMode) return 'tired';
    if (metrics?.state === 'GOOD_POSTURE') return 'good';
    return 'good';
  };

  const state = getPetState();
  const isDanger = state === 'slouch' || state === 'close' || state === 'tired';

  // ── Mobile: fixed bottom-right bubble, no drag ─────────────────────
  if (isMobile) {
    return (
      <motion.div
        className={`fixed bottom-20 right-4 z-50 ${styles.minimized} ${isDanger ? styles.danger : ''}`}
        style={{ width: '60px', height: '60px' }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className={styles.petInner}>
          <OliverPet
            state={state}
            size={64}
            petLevel={stats.petLevel}
            equippedItems={stats.equippedItems}
            hideBubble
            hideBadge
            lowDetail
          />
        </div>
        {isDanger && <div className={styles.dangerBadge}>!</div>}
      </motion.div>
    );
  }

  // ── Desktop minimized bubble ────────────────────────────────────────
  if (isMinimized) {
    return (
      <motion.div
        className={`fixed bottom-6 right-6 z-50 ${styles.minimized} ${isDanger ? styles.danger : ''}`}
        onClick={() => setIsMinimized(false)}
        style={{ width: '60px', height: '60px' }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className={styles.petInner}>
          <OliverPet
            state={state}
            size={64}
            petLevel={stats.petLevel}
            equippedItems={stats.equippedItems}
            hideBubble
            hideBadge
            lowDetail
          />
        </div>
        {isDanger && <div className={styles.dangerBadge}>!</div>}
        {!isDanger && (
          <div className={styles.expandBtn}>
            <Maximize2 size={10} />
          </div>
        )}
      </motion.div>
    );
  }

  // ── Desktop expanded: draggable, always starts at bottom-right ─────
  // Key insight: we use style={{ bottom, right }} instead of CSS classes
  // so framer-motion's drag transform doesn't fight a top/left anchor.
  return (
    <>
      <div ref={constraintsRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: -1 }} />
      <motion.div
        className={`fixed z-50 ${styles.expanded} ${isDanger ? styles.alertBounce : ''}`}
        style={{ bottom: 24, right: 24 }}
        drag
        dragControls={dragControls}
        dragConstraints={constraintsRef}
        dragElastic={0.15}
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
            <OliverPet
              state={state}
              size={135}
              petLevel={stats.petLevel}
              equippedItems={stats.equippedItems}
              lowDetail
            />
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default FloatingPet;