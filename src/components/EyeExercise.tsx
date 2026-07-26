import React, { useState, useEffect, useRef } from 'react';
import { Eye, Award, CheckCircle2 } from 'lucide-react';
import { addXP } from '../services/db';
import { useLanguage } from '../contexts/LanguageContext';
import styles from './EyeExercise.module.css';

interface EyeExerciseProps {
  isBlinking: boolean;
  poseLandmarks?: any[] | null;
  onComplete: (xpGained: number) => void;
}

export const EyeExercise: React.FC<EyeExerciseProps> = ({ isBlinking, poseLandmarks, onComplete }) => {
  const { t } = useLanguage();
  const [blinksCount, setBlinksCount] = useState<number>(0);
  const [bambooCount, setBambooCount] = useState<number>(0);

  const [targetPos, setTargetPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [nosePos, setNosePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  const [exerciseStatus, setExerciseStatus] = useState<'active' | 'success'>('active');

  const wasBlinkingRef = useRef<boolean>(false);

  // Generate new bamboo position — keep within [20,80]% so leaves stay
  // clear of viewport edges (was [15,85]).
  const spawnBamboo = () => {
    const min = 20;
    const max = 80;
    const x = Math.floor(Math.random() * (max - min + 1)) + min;
    const y = Math.floor(Math.random() * (max - min + 1)) + min;
    setTargetPos({ x, y });
  };

  // Process landmarks natively through React effects (approx 30fps from MediaPipe)
  useEffect(() => {
    if (exerciseStatus !== 'active') return;

    if (poseLandmarks && poseLandmarks[0]) {
      const nose = poseLandmarks[0];
      // Mirror x coordinate because camera is mirrored
      const x = (1 - nose.x) * 100;
      const y = nose.y * 100;

      setNosePos({ x, y });

      // Collision detection
      const dx = x - targetPos.x;
      const dy = y - targetPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 8) {
        // Collected bamboo!
        playChime();
        setBambooCount(prev => prev + 1);
        spawnBamboo();
      }
    }
  }, [poseLandmarks, exerciseStatus, targetPos]);

  // Blink counter logic
  useEffect(() => {
    if (exerciseStatus !== 'active') return;

    if (isBlinking && !wasBlinkingRef.current) {
      wasBlinkingRef.current = true;
    } else if (!isBlinking && wasBlinkingRef.current) {
      wasBlinkingRef.current = false;
      setBlinksCount(prev => prev + 1);
      playChime();
    }
  }, [isBlinking, exerciseStatus]);

  // Check win condition
  useEffect(() => {
    if (exerciseStatus === 'active' && blinksCount >= 4 && bambooCount >= 5) {
      setExerciseStatus('success');
      playSuccessFanfare();
      addXP(300);
      setTimeout(() => {
        onComplete(300);
      }, 3000);
    }
  }, [blinksCount, bambooCount, exerciseStatus, onComplete]);

  // Web Audio API synthesizers
  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
      setTimeout(() => ctx.close(), 200);
    } catch {}
  };

  const playSuccessFanfare = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
      playTone(1046.50, 0.45, 0.4); // C6
      setTimeout(() => ctx.close(), 1000);
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
            {/* Render the highlight phrase as bold. The vi.ts strings used to
                inline literal <strong> tags which React renders as plain text;
                split the highlight into its own key so we control the markup. */}
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

      {/* Game layer — wrap leaves + panda in a z-20 layer above the
          instruction card so they are never occluded. */}
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

          {/* Player Nose Tracker (Panda Face) */}
          <div
            className={styles.player}
            style={{
              left: `${nosePos.x}%`,
              top: `${nosePos.y}%`,
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
 * Falls back to plain text when the highlight key is missing or empty
 * (e.g. the en.ts variant has no highlight), so en stays clean.
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
