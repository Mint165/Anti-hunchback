import React, { useState, useEffect, useRef } from 'react';
import { Eye, Award, CheckCircle2 } from 'lucide-react';
import { addPetXP } from '../services/db';
import { useLanguage } from '../contexts/LanguageContext';
import styles from './EyeExercise.module.css';

interface EyeExerciseProps {
  isBlinking: boolean;
  poseLandmarks?: any[] | null;
  onComplete: (xpGained: number) => void;
}

// Shared lazy AudioContext for low latency and zero GC pauses
let sharedAudioCtx: AudioContext | null = null;
function getSharedAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        sharedAudioCtx = new AudioCtxClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export const EyeExercise: React.FC<EyeExerciseProps> = ({ isBlinking, poseLandmarks, onComplete }) => {
  const { t } = useLanguage();
  const [blinksCount, setBlinksCount] = useState<number>(0);
  const [bambooCount, setBambooCount] = useState<number>(0);

  const [targetPos, setTargetPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [exerciseStatus, setExerciseStatus] = useState<'active' | 'success'>('active');

  const playerRef = useRef<HTMLDivElement | null>(null);
  const targetPosRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 });
  const wasBlinkingRef = useRef<boolean>(false);
  const currentNosePosRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 });

  // Sync ref with state
  useEffect(() => {
    targetPosRef.current = targetPos;
  }, [targetPos]);

  // Generate new bamboo position — keep within [20,80]% so leaves stay clear of edges
  const spawnBamboo = () => {
    const min = 20;
    const max = 80;
    const x = Math.floor(Math.random() * (max - min + 1)) + min;
    const y = Math.floor(Math.random() * (max - min + 1)) + min;
    setTargetPos({ x, y });
  };

  // High-performance direct DOM tracking: 60 FPS without React re-render overhead
  useEffect(() => {
    if (exerciseStatus !== 'active') return;

    if (poseLandmarks && poseLandmarks[0]) {
      const nose = poseLandmarks[0];
      // Mirror x coordinate because camera is mirrored
      const x = (1 - nose.x) * 100;
      const y = nose.y * 100;
      currentNosePosRef.current = { x, y };

      if (playerRef.current) {
        playerRef.current.style.left = `${x}%`;
        playerRef.current.style.top = `${y}%`;
      }

      // Collision detection
      const curTarget = targetPosRef.current;
      const dx = x - curTarget.x;
      const dy = y - curTarget.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 8) {
        // Collected bamboo!
        playChime();
        setBambooCount((prev) => prev + 1);
        spawnBamboo();
      }
    }
  }, [poseLandmarks, exerciseStatus]);

  // Blink counter logic
  useEffect(() => {
    if (exerciseStatus !== 'active') return;

    if (isBlinking && !wasBlinkingRef.current) {
      wasBlinkingRef.current = true;
    } else if (!isBlinking && wasBlinkingRef.current) {
      wasBlinkingRef.current = false;
      setBlinksCount((prev) => prev + 1);
      playChime();
    }
  }, [isBlinking, exerciseStatus]);

  // Check win condition
  useEffect(() => {
    if (exerciseStatus === 'active' && blinksCount >= 4 && bambooCount >= 5) {
      setExerciseStatus('success');
      playSuccessFanfare();
      addPetXP(300);
      const timer = setTimeout(() => {
        onComplete(300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [blinksCount, bambooCount, exerciseStatus, onComplete]);

  // Web Audio API synthesizers
  const playChime = () => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  };

  const playSuccessFanfare = () => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      playTone(523.25, 0, 0.15); // C5
      playTone(659.25, 0.15, 0.15); // E5
      playTone(783.99, 0.3, 0.15); // G5
      playTone(1046.5, 0.45, 0.4); // C6
    } catch {}
  };

  return (
    <div className={styles.root}>
      {/* Exercise Active Screen — instruction card pinned top-left */}
      {exerciseStatus === 'active' ? (
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <span style={{ fontSize: 24 }}>🐼</span>
          </div>

          <h2 className={styles.title}>{t('eyeExercise.title')}</h2>
          <p className={styles.desc}>
            {t('eyeExercise.desc')}
            <br />
            <TransStep text={t('eyeExercise.step1')} highlight={t('eyeExercise.step1Highlight')} />
            <br />
            <TransStep text={t('eyeExercise.step2')} highlight={t('eyeExercise.step2Highlight')} />
          </p>

          {/* Progress indicators */}
          <div className={styles.progressGrid}>
            <div className={styles.progressCell}>
              <span className={`${styles.progressLabel} ${styles.progressLabelBlink}`}>
                <Eye size={18} /> {t('eyeExercise.blinks')}: {blinksCount}/4
              </span>
              <div className={styles.track}>
                <div
                  className={styles.fillBlink}
                  style={{ width: `${Math.min(100, (blinksCount / 4) * 100)}%` }}
                />
              </div>
            </div>

            <div className={styles.progressCell}>
              <span className={`${styles.progressLabel} ${styles.progressLabelBamboo}`}>
                🌿 {t('eyeExercise.bamboo')}: {bambooCount}/5
              </span>
              <div className={styles.track}>
                <div
                  className={styles.fillBamboo}
                  style={{ width: `${Math.min(100, (bambooCount / 5) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <button onClick={() => onComplete(0)} className={styles.skipBtn}>
            {t('eyeExercise.skipBtn')}
          </button>
        </div>
      ) : (
        // Exercise Success Screen
        <div className={styles.successCard}>
          <div className={`${styles.iconWrap} ${styles.iconWrapSuccess}`}>
            <CheckCircle2 size={50} />
          </div>
          <h2 className={styles.titleSuccess}>{t('eyeExercise.successTitle')}</h2>
          <p className={styles.desc} style={{ fontSize: 20 }}>
            {t('eyeExercise.successDesc')}
          </p>
          <div className={styles.xpBadge}>
            <Award size={24} /> {t('eyeExercise.xpReward')}
          </div>
        </div>
      )}

      {/* Game layer — wrap leaves + panda in a z-20 layer above the instruction card */}
      {exerciseStatus === 'active' && (
        <div className={styles.gameLayer}>
          {/* Target Bamboo */}
          <div
            className={styles.target}
            style={{
              left: `${targetPos.x}%`,
              top: `${targetPos.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className={styles.targetInner}>🌿</div>
          </div>

          {/* Player Nose Tracker (Panda Face) — Direct DOM animated */}
          <div
            ref={playerRef}
            className={styles.player}
            style={{
              left: `${currentNosePosRef.current.x}%`,
              top: `${currentNosePosRef.current.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className={styles.playerInner}>🐼</div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Render a step instruction with an optional bold highlight phrase.
 */
const TransStep: React.FC<{ text: string; highlight?: string }> = ({ text, highlight }) => {
  if (!highlight) return <>{text}</>;
  const idx = text.indexOf(highlight);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <strong className={styles.descStrong}>{highlight}</strong>
      {text.slice(idx + highlight.length)}
    </>
  );
};

export default EyeExercise;
