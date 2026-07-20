// Student Workspace — Asymmetric adventure dashboard (redesigned).
// All logic/lifecycle/overlay behaviour preserved from the previous
// implementation; only layout + styling changed.

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Trophy,
  BookOpen,
  Volume2,
  VolumeX,
  CameraOff,
  Info,
  X,
  Play,
  Pause,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CalibrationData } from '../services/postureAI';
import { loadUserStats, saveSessionRecord, addXP, getBadgesStatus } from '../services/db';
import type { Badge } from '../services/db';
import { broadcastStudentStatus, broadcastFatigueAlert } from '../services/parentSync';
import { usePostureContext } from '../contexts/PostureContext';
import { useLanguage } from '../contexts/LanguageContext';
import { voiceService } from '../services/voiceService';
import type { PetState } from './OliverPet';
import Calibration from './Calibration';
import BackboneVisualizer from './BackboneVisualizer';
import TiltCard from './ui/TiltCard';
import StatRing from './ui/StatRing';
import AnimatedCounter from './ui/AnimatedCounter';
import styles from './StudentView.module.css';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

// Static SVG pet avatar — lightweight alternative to the 3D OliverPet
// in the mini card. Avoids spawning a second WebGL context on the
// Student dashboard (each context is expensive).
const PetAvatarSVG: React.FC<{ state: PetState }> = ({ state }) => {
  // Body color shifts slightly per state to convey mood.
  const bodyColor =
    state === 'good' ? '#60A5FA' :
    state === 'slouch' ? '#94A3B8' :
    state === 'close' ? '#F59E0B' :
    state === 'writing' ? '#A78BFA' :
    '#60A5FA';
  const cheekColor = state === 'good' ? '#F472B6' : '#FCA5A5';
  // Mouth changes with mood.
  const mouthPath =
    state === 'good' ? 'M 18 32 Q 24 38 30 32' :
    state === 'slouch' ? 'M 18 34 Q 24 30 30 34' :
    state === 'close' ? 'M 18 34 Q 24 32 30 34' :
    'M 18 33 Q 24 36 30 33';
  return (
    <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden>
      {/* body */}
      <circle cx="24" cy="24" r="16" fill={bodyColor} />
      {/* ears */}
      <circle cx="12" cy="14" r="5" fill={bodyColor} />
      <circle cx="36" cy="14" r="5" fill={bodyColor} />
      <circle cx="12" cy="14" r="2.5" fill="#3B82F6" opacity="0.6" />
      <circle cx="36" cy="14" r="2.5" fill="#3B82F6" opacity="0.6" />
      {/* eyes */}
      <circle cx="18" cy="24" r="2.4" fill="#0F172A" />
      <circle cx="30" cy="24" r="2.4" fill="#0F172A" />
      <circle cx="18.8" cy="23.2" r="0.8" fill="#fff" />
      <circle cx="30.8" cy="23.2" r="0.8" fill="#fff" />
      {/* cheeks */}
      <circle cx="13" cy="29" r="2.2" fill={cheekColor} opacity="0.7" />
      <circle cx="35" cy="29" r="2.2" fill={cheekColor} opacity="0.7" />
      {/* mouth */}
      <path d={mouthPath} stroke="#0F172A" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
};

export const StudentView: React.FC = () => {
  const {
    metrics, healthScore, alertLevel, hasStarted, startSession, resetBreak,
    isModelReady, isLoading, error, calibration, setCalibration,
    poseLandmarks, faceLandmarks,
    sessionFatigueFlags, sessionAngleAccumulator,
    isManualWritingMode,
    setIsManualWritingMode,
  } = usePostureContext();
  const { t } = useLanguage();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showCamera, setShowCamera] = useState<boolean>(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [showTips, setShowTips] = useState<boolean>(false);

  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [sessionElapsedSeconds, setSessionElapsedSeconds] = useState<number>(0);
  const totalSessionMinutes = Math.floor(sessionElapsedSeconds / 60);

  const warningsCountRef = useRef<number>(0);
  const blinkCountRef = useRef<number>(0);
  const fidgetCountRef = useRef<number>(0);
  const goodPostureCountRef = useRef<number>(0);
  const totalTicksRef = useRef<number>(0);

  const [userStats, setUserStats] = useState(loadUserStats());
  const [badges, setBadges] = useState<Badge[]>(getBadgesStatus());

  // Attach global video stream to local video element for preview
  useEffect(() => {
    const globalVideo = document.getElementById('global-webcam') as HTMLVideoElement;
    if (!globalVideo) return;
    const syncStream = () => {
      if (videoRef.current && videoRef.current.srcObject !== globalVideo.srcObject) {
        videoRef.current.srcObject = globalVideo.srcObject;
      }
    };
    syncStream();
    globalVideo.addEventListener('loadedmetadata', syncStream);
    globalVideo.addEventListener('play', syncStream);
    // Poll less aggressively — events above cover most cases; the
    // 2s interval is a safety net for stream re-attachments.
    const interval = setInterval(syncStream, 2000);
    return () => {
      globalVideo.removeEventListener('loadedmetadata', syncStream);
      globalVideo.removeEventListener('play', syncStream);
      clearInterval(interval);
    };
  }, [showCamera, hasStarted, isModelReady]);

  useEffect(() => {
    if (!hasStarted) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
      setSessionElapsedSeconds(elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime, hasStarted]);

  useEffect(() => {
    if (alertLevel === 'STRONG_WARNING') {
      warningsCountRef.current += 1;
      if (isAudioEnabled) playBeepSound();
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    }
  }, [alertLevel, isAudioEnabled]);

  const lastBroadcastRef = useRef<number>(0);

  useEffect(() => {
    if (!isModelReady || !calibration || !metrics) return;
    totalTicksRef.current += 1;
    if (healthScore >= 80) goodPostureCountRef.current += 1;
    if (metrics.isBlinking) blinkCountRef.current += 1;
    if (metrics.fidgetFactor > 40 && totalTicksRef.current > 0 && totalTicksRef.current % 300 === 0) {
      fidgetCountRef.current += 1;
      broadcastFatigueAlert(t('student.fidgetAlert'));
    }
    const now = Date.now();
    if (now - lastBroadcastRef.current >= 2000) {
      const overallStatus = healthScore >= 85 ? 'good' : healthScore >= 70 ? 'warning' : 'danger';
      broadcastStudentStatus(overallStatus, {
        eyeDistanceCm: metrics.eyeDistanceCm,
        neckAngle: metrics.neckAngle,
        shoulderTilt: metrics.shoulderTilt,
        slouchAngle: metrics.slouchAngle,
        healthScore: healthScore,
        isWritingMode: metrics.isWritingMode,
      });
      lastBroadcastRef.current = now;
    }
  }, [metrics, healthScore, isModelReady, calibration]);

  const playBeepSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playChime = (start: number, freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + 1.5);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + 1.5);
      };
      playChime(0, 523.25);
      playChime(0.1, 659.25);
      playChime(0.2, 783.99);
      setTimeout(() => ctx.close(), 2000);
      setTimeout(() => {
        voiceService.speak(t('student.sitStraightVoice'));
      }, 500);
    } catch {}
  };

  const getPetState = (): PetState => {
    if (metrics?.isWritingMode) return 'writing';
    if (metrics && metrics.eyeDistanceCm < 50) return 'close';
    if (metrics && (metrics.slouchAngle > 15 || metrics.shoulderTilt > 7)) return 'slouch';
    return 'good';
  };

  const handleCalibrationComplete = (data: CalibrationData) => {
    setCalibration(data);
    setSessionStartTime(Date.now());
  };

  const handleEndSession = () => {
    if (totalTicksRef.current === 0) return;
    const goodPosturePercentage = Math.round((goodPostureCountRef.current / totalTicksRef.current) * 100);
    const sessionRecord = {
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString().split('T')[0],
      startTime: sessionStartTime,
      endTime: Date.now(),
      durationMinutes: Math.max(1, totalSessionMinutes),
      averageHealthScore: Math.round(healthScore),
      goodPosturePercentage,
      warningsCount: warningsCountRef.current,
      blinksCount: blinkCountRef.current,
      fidgetFlagsCount: fidgetCountRef.current,
      completedEyeExercises: Math.floor(totalSessionMinutes / 20),
      streakAdded: true,
      averageShoulderTilt: sessionAngleAccumulator.tickCount > 0
        ? Math.round((sessionAngleAccumulator.shoulderTiltSum / sessionAngleAccumulator.tickCount) * 10) / 10
        : 0,
      averageNeckAngle: sessionAngleAccumulator.tickCount > 0
        ? Math.round((sessionAngleAccumulator.neckAngleSum / sessionAngleAccumulator.tickCount) * 10) / 10
        : 0,
      averageSlouchAngle: sessionAngleAccumulator.tickCount > 0
        ? Math.round((sessionAngleAccumulator.slouchAngleSum / sessionAngleAccumulator.tickCount) * 10) / 10
        : 0,
      fatigueFlags: sessionFatigueFlags,
    };
    saveSessionRecord(sessionRecord);

    if (goodPosturePercentage > 80 && totalSessionMinutes >= 5) {
      const { leveledUp } = addXP(500);
      if (leveledUp) {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 10000 });
        toast.success(t('student.leveledUp'), { icon: '🎉', duration: 5000 });
      } else {
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 }, zIndex: 10000 });
      }
      const isNew = badges.find((b) => b.id === 'warrior')?.unlocked === false;
      if (isNew) {
        localStorage.setItem('oliver_unlocked_badge_warrior', 'true');
        addXP(1000);
        setTimeout(() => {
          toast.success(t('student.unlockedWarrior'), { icon: '🛡️', duration: 5000 });
        }, 1000);
      }
    }

    setSessionStartTime(Date.now());
    setSessionElapsedSeconds(0);
    warningsCountRef.current = 0;
    blinkCountRef.current = 0;
    fidgetCountRef.current = 0;
    goodPostureCountRef.current = 0;
    totalTicksRef.current = 0;
    setUserStats(loadUserStats());
    setBadges(getBadgesStatus());
    toast.success(t('student.sessionSaved'), {
      duration: 4000,
      position: 'top-center',
    });
  };

  const [showOnboarding, setShowOnboarding] = useState<boolean>(!localStorage.getItem('oliver_onboarded'));

  const handleFinishOnboarding = () => {
    localStorage.setItem('oliver_onboarded', 'true');
    setShowOnboarding(false);
  };

  // ── Onboarding overlay ────────────────────────────────────────────
  if (!calibration) {
    if (showOnboarding) {
      return (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center text-white text-center p-8"
          style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #0F0D1A 50%, #1E1B4B 100%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
            style={{ background: 'rgba(124, 58, 237, 0.2)' }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
          >
            <Trophy size={48} className="text-purple-400" />
          </motion.div>
          <motion.h2
            className="text-5xl font-black mb-4 tracking-tight"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {t('student.welcomeTitle')}
          </motion.h2>
          <motion.p
            className="text-gray-300 text-xl mb-10 max-w-lg leading-relaxed"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {t('student.welcomeDesc')}
          </motion.p>
          <motion.button
            onClick={handleFinishOnboarding}
            className="btn-3d btn-3d-primary text-lg px-10 py-4"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {t('student.startBtn')}
          </motion.button>
        </motion.div>
      );
    }

    return (
      <div className="calibration-container">
        <div className="premium-card calibration-card dark:bg-slate-800">
          <h2 className="calibration-title dark:text-white">{t('student.startSessionTitle')}</h2>
          <p className="calibration-desc dark:text-gray-300">{t('student.startSessionDesc')}</p>
          <div className="calibration-video-wrapper relative">
            <video ref={videoRef} className="calibration-video" autoPlay playsInline muted />
            {error ? (
              <div className="absolute inset-0 bg-red-950/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 rounded-3xl z-10">
                <AlertTriangle size={40} className="text-red-500 mb-2 animate-bounce" />
                <span className="font-bold text-red-200 text-sm">{error}</span>
              </div>
            ) : isLoading ? (
              <div className="calibration-loading">
                <div className="spinner" />
                <span>{t('student.loadingAI')}</span>
              </div>
            ) : null}
          </div>
          <Calibration poseLandmarks={poseLandmarks} faceLandmarks={faceLandmarks} onCalibrationComplete={handleCalibrationComplete} isModelReady={isModelReady} />
        </div>
      </div>
    );
  }

  const scoreColor = healthScore >= 80 ? '#00d285' : healthScore >= 60 ? '#FFAA2C' : '#FF5E5E';
  const mm = (totalSessionMinutes % 60).toString().padStart(2, '0');
  const ss = (sessionElapsedSeconds % 60).toString().padStart(2, '0');

  // Stat bar helpers
  const distanceValue = metrics ? metrics.eyeDistanceCm : 60;
  const distancePass = distanceValue >= 50;
  const slouchValue = metrics ? Math.round(metrics.slouchAngle) : 0;
  const slouchPass = slouchValue <= 15;
  const neckValue = metrics ? Math.round(metrics.neckAngle) : 0;
  const neckPass = metrics ? (metrics.neckAngle <= 20 || metrics.isWritingMode) : true;

  return (
    <div className={`${styles.container} ${alertLevel === 'MILD_WARNING' ? 'screen-alert-glow' : ''}`}>
      {/* ── Tips modal ──────────────────────────────────────────────── */}
      {showTips && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl relative animate-slide-in-right">
            <button onClick={() => setShowTips(false)} className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-full transition-colors">
              <X size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
            <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-6">{t('student.tipsTitle')}</h3>
            <div className="space-y-4">
              {metrics && metrics.slouchAngle > 10 ? (
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-xl">
                  <div className="font-bold text-orange-800 dark:text-orange-300 mb-1">{t('student.warnSlouch')}</div>
                  <div className="text-orange-600 dark:text-orange-400 text-sm">Góc lưng hiện tại là {Math.round(metrics.slouchAngle)}°. {t('student.warnSlouchDesc')}</div>
                </div>
              ) : (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl">
                  <div className="font-bold text-green-800 dark:text-green-300 mb-1">{t('student.goodSlouch')}</div>
                  <div className="text-green-600 dark:text-green-400 text-sm">{t('student.goodSlouchDesc')}</div>
                </div>
              )}
              {metrics && metrics.eyeDistanceCm < 50 ? (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl">
                  <div className="font-bold text-red-800 dark:text-red-300 mb-1">{t('student.warnEye')}</div>
                  <div className="text-red-600 dark:text-red-400 text-sm">Khoảng cách hiện tại: {metrics.eyeDistanceCm}cm. {t('student.warnEyeDesc')}</div>
                </div>
              ) : (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                  <div className="font-bold text-blue-800 dark:text-blue-300 mb-1">{t('student.goodEye')}</div>
                  <div className="text-blue-600 dark:text-blue-400 text-sm">{t('student.goodEyeDesc')}</div>
                </div>
              )}
            </div>
            <button onClick={() => setShowTips(false)} className="w-full btn-primary py-3 mt-6">{t('student.gotIt')}</button>
          </div>
        </div>
      )}

      {/* ── "Ready" start overlay ───────────────────────────────────── */}
      <AnimatePresence>
        {!hasStarted && (
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center text-white text-center p-8"
            style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #0F0D1A 50%, #1E1B4B 100%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.h2
              className="text-5xl font-black mb-4 tracking-tight"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              {t('student.readyTitle')}
            </motion.h2>
            <motion.p
              className="text-gray-300 text-xl mb-10 max-w-lg leading-relaxed"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              {t('student.readyDesc')}
            </motion.p>
            <motion.button
              onClick={() => { startSession(); setSessionStartTime(Date.now()); }}
              className="btn-3d btn-3d-secondary text-lg px-10 py-4"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              {t('student.startLearn')}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Break time overlay ─────────────────────────────────────── */}
      {alertLevel === 'BREAK_TIME' && (
        <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-3xl flex flex-col items-center justify-center text-white text-center p-8">
          <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 mb-6 animate-pulse">
            <BookOpen size={48} />
          </div>
          <h2 className="text-5xl font-black mb-4 tracking-tight">{t('student.breakTitle')}</h2>
          <p className="text-gray-300 text-xl mb-10 max-w-lg leading-relaxed">{t('student.breakDesc')}</p>
          <button onClick={() => resetBreak()} className="btn-secondary text-lg px-10 py-4 shadow-[0_8px_32px_rgba(74,222,128,0.4)]">
            {t('student.breakBtn')}
          </button>
        </div>
      )}

      {/* ── Strong warning overlay ─────────────────────────────────── */}
      {alertLevel === 'STRONG_WARNING' && (
        <div className="fixed inset-0 z-50 bg-red-900/60 flex items-center justify-center p-4">
          <div className="premium-card bg-red-950 border-2 border-red-500 p-10 max-w-lg shadow-[0_0_80px_rgba(255,94,94,0.3)] subtle-pulse relative">
            <AlertTriangle size={72} className="text-red-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(255,94,94,0.5)]" />
            <h2 className="text-4xl font-black text-white text-center mb-4">{t('student.dangerTitle')}</h2>
            <p className="text-red-100 text-center text-lg mb-8 leading-relaxed font-medium">{t('student.dangerDesc')}</p>
            <button onClick={() => resetBreak()} className="btn-primary w-full bg-red-500 hover:bg-red-600 text-white border-none py-4 text-lg font-bold">
              {t('student.fixedBtn')}
            </button>
          </div>
        </div>
      )}

      {/* ── Top action bar (no search bar per plan) ─────────────────── */}
      <div className={styles.topbar}>
        <button
          onClick={() => setIsManualWritingMode(!isManualWritingMode)}
          className={`${styles.actionBtn} ${isManualWritingMode ? styles.actionBtnActive : ''}`}
          title={t('student.writingMode')}
        >
          {t('student.writingModeOn')}
        </button>
        <button onClick={() => setIsAudioEnabled(!isAudioEnabled)} className={styles.audioBtn}>
          {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
        <button onClick={() => setCalibration(null)} className={styles.recalBtn}>
          <RefreshCw size={14} /> {t('student.recalibrate')}
        </button>
      </div>

      {/* ── Hero: score ring + pet mini + streak ─────────────────────── */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroScore}>
            <StatRing
              value={healthScore}
              max={100}
              size={150}
              strokeWidth={12}
              label="PHI"
              suffix=""
              trackColor="rgba(255,255,255,0.18)"
              gradient={{ id: 'hero-score', from: scoreColor, to: scoreColor }}
            />
          </div>
          <div className={styles.heroCenter}>
            <h1 className={styles.heroTitle}>{t('student.heroTitle')}</h1>
            <p className={styles.heroDesc}>{t('student.heroDesc')}</p>
            <button className={styles.heroSaveBtn} onClick={handleEndSession}>
              {t('student.saveSession')}
            </button>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatIcon} style={{ background: '#facc15', color: '#713f12' }}>🔥</div>
              <div>
                <div className={styles.heroStatVal}>
                  <AnimatedCounter value={userStats.streak} suffix={` ${t('student.streakDays')}`} duration={700} />
                </div>
                <div className={styles.heroStatLbl}>{t('student.hardwork')}</div>
              </div>
            </div>
            <div className={styles.heroStatCard}>
              <div className={styles.heroStatIcon} style={{ background: '#60a5fa', color: '#1e3a8a' }}>⭐</div>
              <div>
                <div className={styles.heroStatVal}>
                  {t('student.level')} <AnimatedCounter value={userStats.level} duration={700} />
                </div>
                <div className={styles.heroStatLbl}>{t('student.currentRank')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Middle row: compact camera + live stat bars ──────────────── */}
      <div className={styles.midRow}>
        <TiltCard className={styles.cameraCard} intensity={3}>
          <div className={styles.cameraHeader}>
            <div className={styles.cameraTitle}>
              <Play size={14} style={{ color: 'var(--primary)' }} /> {t('student.cameraAi')}
            </div>
            <motion.button
              onClick={() => setShowCamera(!showCamera)}
              className={`${styles.cameraToggle} ${showCamera ? styles.cameraToggleOff : styles.cameraToggleOn}`}
              whileTap={{ scale: 0.9 }}
            >
              {showCamera ? t('student.off') : t('student.on')}
            </motion.button>
          </div>
          <div className={styles.cameraWrapper}>
            {error && showCamera ? (
              <div className={styles.cameraError}>
                <AlertTriangle size={28} className="mb-1" />
                <span>{error}</span>
              </div>
            ) : null}
            <video ref={videoRef} className={`${styles.cameraVideo} ${!showCamera ? 'hidden' : ''}`} autoPlay playsInline muted />
            {!showCamera && (
              <div className={styles.cameraPlaceholder}>
                <CameraOff size={24} />
              </div>
            )}
            {showCamera && metrics && !error && (
              <BackboneVisualizer
                neckAngle={metrics.neckAngle}
                slouchAngle={metrics.slouchAngle}
                healthScore={healthScore}
              />
            )}
          </div>
          <button
            onClick={() => setIsManualWritingMode(!isManualWritingMode)}
            className={`${styles.writingToggle} ${isManualWritingMode ? styles.writingToggleOn : ''}`}
          >
            {t('student.writingMode')}
          </button>
        </TiltCard>

        <div className={styles.statsCard}>
          <div className={styles.statsHeader}>
            <div className={styles.statsTitle}>
              <Trophy size={18} style={{ color: 'var(--primary)' }} /> {t('student.statusTable')}
            </div>
            <motion.div
              className={styles.livePill}
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatType: 'loop' }}
            >
              {t('student.live')}
            </motion.div>
          </div>

          {/* Distance */}
          <div className={styles.statRow}>
            <div className={styles.statRowHead}>
              <div className={styles.statLabel}>
                <div className={styles.statIcon} style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>🏃</div>
                {t('student.distance')}
              </div>
              <span className={styles.statGoal}>&gt; 50 cm</span>
            </div>
            <div className={styles.statBar}>
              <motion.div
                className={styles.statBarFill}
                style={{ background: distancePass ? 'var(--secondary)' : 'var(--danger)' }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (distanceValue / 80) * 100)}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
            <div className={`${styles.statValue} ${distancePass ? styles.statValuePass : styles.statValueFail}`}>
              {distanceValue} cm
            </div>
          </div>

          {/* Slouch */}
          <div className={styles.statRow}>
            <div className={styles.statRowHead}>
              <div className={styles.statLabel}>
                <div className={styles.statIcon} style={{ background: 'var(--secondary-light)', color: 'var(--secondary)' }}>🧍</div>
                {t('student.backSlouch')}
              </div>
              <span className={styles.statGoal}>&lt; 15°</span>
            </div>
            <div className={styles.statBar}>
              <motion.div
                className={styles.statBarFill}
                style={{ background: slouchPass ? 'var(--secondary)' : 'var(--danger)' }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (slouchValue / 30) * 100)}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
            <div className={`${styles.statValue} ${slouchPass ? styles.statValuePass : styles.statValueFail}`}>
              {slouchValue}°
            </div>
          </div>

          {/* Neck tilt */}
          <div className={styles.statRow}>
            <div className={styles.statRowHead}>
              <div className={styles.statLabel}>
                <div className={styles.statIcon} style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>🧘</div>
                {t('student.neckTilt')}
              </div>
              <span className={styles.statGoal}>&lt; 20°</span>
            </div>
            <div className={styles.statBar}>
              <motion.div
                className={styles.statBarFill}
                style={{ background: neckPass ? 'var(--secondary)' : 'var(--danger)' }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (neckValue / 40) * 100)}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
            <div className={`${styles.statValue} ${neckPass ? styles.statValuePass : styles.statValueFail}`}>
              {neckValue}°
            </div>
          </div>

          {/* Tips inline */}
          <motion.button
            className={styles.tipsInline}
            onClick={() => setShowTips(true)}
            whileTap={{ scale: 0.98 }}
          >
            <Info size={18} style={{ color: 'var(--primary)' }} />
            <div style={{ flex: 1 }}>
              <div className={styles.tipsInlineText}>{t('student.aiTipsCount')}</div>
              <div className={styles.tipsInlineSub}>{t('student.aiTipsDesc')}</div>
            </div>
            <span dangerouslySetInnerHTML={{ __html: t('student.viewTips') }} />
          </motion.button>
        </div>
      </div>

      {/* ── Bottom row: 4 floating island mini-cards ────────────────── */}
      <div className={styles.miniRow}>
        {/* Timer (circular) */}
        <div className={styles.miniCard}>
          <div className={styles.miniAccent} style={{ background: 'var(--accent)' }} />
          <div className={styles.miniIcon} style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
            <Play size={18} />
          </div>
          <div className={styles.miniLabel}>{t('student.timer')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className={styles.timerRing}>
              <StatRing
                value={(sessionElapsedSeconds % 60)}
                max={60}
                size={64}
                strokeWidth={6}
                trackColor="rgba(124,58,237,0.1)"
                progressColor="var(--accent)"
                animateCount={false}
              />
              <div className={styles.timerRingText}>{ss}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className={styles.miniValue}>{mm}:{ss}</span>
              <span className={styles.miniSub}>
                {Math.floor(totalSessionMinutes / 60).toString().padStart(2, '0')}h {mm}m
              </span>
            </div>
          </div>
          <button className={styles.timerResetBtn} onClick={() => resetBreak()}>
            <Pause size={12} style={{ display: 'inline', marginRight: 4 }} />
            {t('student.newSession')}
          </button>
        </div>

        {/* XP / Level */}
        <div className={styles.miniCard}>
          <div className={styles.miniAccent} style={{ background: 'var(--primary)' }} />
          <div className={styles.miniIcon} style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Trophy size={18} />
          </div>
          <div className={styles.miniLabel}>{t('student.levelXp')}</div>
          <span className={styles.miniValue}>
            {t('student.level')} <AnimatedCounter value={userStats.level} duration={700} />
          </span>
          <div className={styles.xpBar}>
            <motion.div
              className={styles.xpBarFill}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (userStats.xp / (userStats.level * 1000)) * 100)}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </div>
          <span className={styles.miniSub}>{userStats.xp} / {userStats.level * 1000} XP</span>
        </div>

        {/* Pet mini */}
        <div className={styles.miniCard}>
          <div className={styles.miniAccent} style={{ background: '#60A5FA' }} />
          <div className={styles.miniIcon} style={{ background: 'rgba(96, 165, 250, 0.15)', color: '#3B82F6' }}>
            <Play size={18} />
          </div>
          <div className={styles.miniLabel}>{t('student.petName')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className={styles.petMiniWrap}>
              {/* Static SVG pet avatar — avoids extra WebGL context for performance */}
              <PetAvatarSVG state={getPetState()} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className={styles.miniValue}>Lv.{userStats.petLevel}</span>
              <span className={styles.petStatusPill}>
                {getPetState() === 'good' ? t('student.stateHappy') : getPetState() === 'slouch' ? t('student.stateSad') : t('student.stateWarning')}
              </span>
            </div>
          </div>
        </div>

        {/* Actions / quick info */}
        <div className={styles.miniCard}>
          <div className={styles.miniAccent} style={{ background: 'var(--secondary)' }} />
          <div className={styles.miniIcon} style={{ background: 'var(--secondary-light)', color: 'var(--secondary)' }}>
            <Trophy size={18} />
          </div>
          <div className={styles.miniLabel}>{t('student.aiHelp')}</div>
          <span className={styles.miniValue}>
            <AnimatedCounter value={goodPostureCountRef.current} duration={600} />
          </span>
          <span className={styles.miniSub}>{t('student.keepGreen')}</span>
        </div>
      </div>
    </div>
  );
};

export default StudentView;