// Student Workspace Component — Gamified Bento Grid

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, Trophy, BookOpen, Volume2, VolumeX, CameraOff, Play, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CalibrationData } from '../services/postureAI';
import { loadUserStats, saveSessionRecord, addXP, getBadgesStatus } from '../services/db';
import type { Badge } from '../services/db';
import { broadcastStudentStatus, broadcastFatigueAlert } from '../services/parentSync';
import { usePostureContext } from '../contexts/PostureContext';
import { useLanguage } from '../contexts/LanguageContext';
import { voiceService } from '../services/voiceService';
import OliverPet from './OliverPet';
import type { PetState } from './OliverPet';
import Calibration from './Calibration';
import BackboneVisualizer from './BackboneVisualizer';
import TiltCard from './ui/TiltCard';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

export const StudentView: React.FC = () => {
  const {
    metrics, healthScore, alertLevel, hasStarted, startSession, resetBreak,
    isModelReady, isLoading, error, calibration, setCalibration, 
    poseLandmarks, faceLandmarks,
    sessionFatigueFlags, sessionAngleAccumulator,
    latestParentMessage,
    isManualWritingMode,
    setIsManualWritingMode
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

    // Sync immediately
    syncStream();

    // Also sync on loadedmetadata / play events when the stream starts
    globalVideo.addEventListener('loadedmetadata', syncStream);
    globalVideo.addEventListener('play', syncStream);

    // Also set up an interval to ensure sync (in case events fire before we attach)
    const interval = setInterval(syncStream, 1000);

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

  // Throttle broadcast to once every 2 seconds
  const lastBroadcastRef = useRef<number>(0);

  useEffect(() => {
    if (!isModelReady || !calibration || !metrics) return;

    totalTicksRef.current += 1;
    if (healthScore >= 80) {
      goodPostureCountRef.current += 1;
    }

    if (metrics.isBlinking) {
      blinkCountRef.current += 1;
    }

    if (metrics.fidgetFactor > 40 && totalTicksRef.current > 0 && totalTicksRef.current % 300 === 0) {
      fidgetCountRef.current += 1;
      broadcastFatigueAlert("Bé bắt đầu nhấp nhổm nhiều, có dấu hiệu mất tập trung hoặc mỏi cơ.");
    }

    // Throttle: only broadcast once every 2 seconds
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
      playChime(0, 523.25); // C5
      playChime(0.1, 659.25); // E5
      playChime(0.2, 783.99); // G5
      setTimeout(() => ctx.close(), 2000);

      setTimeout(() => {
        voiceService.speak("Chủ nhân ơi, ngồi thẳng lên nhé!");
      }, 500);
    } catch {}
  };

  const getPetState = (): PetState => {
    if (metrics?.isWritingMode) return 'writing';
    if (metrics && metrics.eyeDistanceCm < 50) return 'close';
    if (metrics && (metrics.slouchAngle > 15 || metrics.shoulderTilt > 7)) return 'slouch';
    if (healthScore >= 80) return 'good';
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
      // Data Analytics fields
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
        toast.success('Chúc mừng! Bạn đã thăng cấp!', { icon: '🎉', duration: 5000 });
      } else {
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 }, zIndex: 10000 });
      }

      const isNew = badges.find(b => b.id === 'warrior')?.unlocked === false;
      if (isNew) {
        localStorage.setItem('oliver_unlocked_badge_warrior', 'true');
        addXP(1000);
        setTimeout(() => {
          toast.success('Đã mở khoá huy hiệu: Chiến binh Bền bỉ!', { icon: '🛡️', duration: 5000 });
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
    toast.success('Buổi học đã hoàn thành! Dữ liệu đã được lưu trữ.', {
      duration: 4000,
      position: 'top-center',
    });
  };

  const [showOnboarding, setShowOnboarding] = useState<boolean>(!localStorage.getItem('oliver_onboarded'));

  const handleFinishOnboarding = () => {
    localStorage.setItem('oliver_onboarded', 'true');
    setShowOnboarding(false);
  };

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
  const hh = Math.floor(totalSessionMinutes / 60).toString().padStart(2, '0');
  const mm = (totalSessionMinutes % 60).toString().padStart(2, '0');
  const ss = (sessionElapsedSeconds % 60).toString().padStart(2, '0');

  return (
    <div className={`min-h-full ${alertLevel === 'MILD_WARNING' ? 'screen-alert-glow' : ''}`}>
      
      {/* Overlays */}
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

      {alertLevel === 'BREAK_TIME' && (
        <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-3xl flex flex-col items-center justify-center text-white text-center p-8">
          <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 mb-6 animate-pulse">
            <BookOpen size={48} />
          </div>
          <h2 className="text-5xl font-black mb-4 tracking-tight">{t('student.breakTitle')}</h2>
          <p className="text-gray-300 text-xl mb-10 max-w-lg leading-relaxed">
            {t('student.breakDesc')}
          </p>
          <button onClick={() => resetBreak()} className="btn-secondary text-lg px-10 py-4 shadow-[0_8px_32px_rgba(74,222,128,0.4)]">
            {t('student.breakBtn')}
          </button>
        </div>
      )}

      {alertLevel === 'STRONG_WARNING' && (
        <div className="fixed inset-0 z-50 bg-red-900/60 flex items-center justify-center p-4">
          <div className="premium-card bg-red-950 border-2 border-red-500 p-10 max-w-lg shadow-[0_0_80px_rgba(255,94,94,0.3)] subtle-pulse relative">
            <AlertTriangle size={72} className="text-red-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(255,94,94,0.5)]" />
            <h2 className="text-4xl font-black text-white text-center mb-4">{t('student.dangerTitle')}</h2>
            <p className="text-red-100 text-center text-lg mb-8 leading-relaxed font-medium">
              {t('student.dangerDesc')}
            </p>
            <button onClick={() => resetBreak()} className="btn-primary w-full bg-red-500 hover:bg-red-600 text-white border-none py-4 text-lg font-bold">
              {t('student.fixedBtn')}
            </button>
          </div>
        </div>
      )}

      <div className="sv-container">
        
        {/* Header Controls */}
        <div className="sv-header">
          <div className="sv-search">
             <div className="sv-search-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                </svg>
             </div>
             <input type="text" className="sv-search-input" placeholder="Search features..." />
          </div>
          
          <div className="sv-actions">
            <button 
              onClick={() => setIsManualWritingMode(!isManualWritingMode)} 
              className={`px-4 py-2 hidden sm:block rounded-xl font-bold text-sm transition-colors ${isManualWritingMode ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
              title={t('student.writingMode')}
            >
              {t('student.writingModeOn')}
            </button>
            <button onClick={() => setIsAudioEnabled(!isAudioEnabled)} className="sv-audio-btn dark:bg-slate-800 dark:text-gray-300 dark:border-gray-700 border">
              {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button onClick={() => setCalibration(null)} className="pill-tag pill-primary">
              <RefreshCw size={14} className="mr-1" /> {t('student.recalibrate')}
            </button>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="hero-banner">
          <div className="hero-content">
            <div className="hero-text">
              <h1>{t('student.heroTitle')}</h1>
              <p>{t('student.heroDesc')}</p>
              <button className="btn-primary" onClick={handleEndSession}>{t('student.saveSession')}</button>
            </div>
            
            <div className="hero-stats">
              <div className="hero-stat-card">
                <div className="hero-stat-icon" style={{ background: '#facc15', color: '#713f12' }}>🔥</div>
                <div>
                  <div className="hero-stat-val">{userStats.streak} {t('student.streakDays')}</div>
                  <div className="hero-stat-lbl">{t('student.hardwork')}</div>
                </div>
              </div>
              <div className="hero-stat-card">
                <div className="hero-stat-icon" style={{ background: '#60a5fa', color: '#1e3a8a' }}>⭐</div>
                <div>
                  <div className="hero-stat-val">{t('student.level')} {userStats.level}</div>
                  <div className="hero-stat-lbl">{t('student.currentRank')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3-Column Premium Grid */}
        <div className="sv-grid">
          
          {/* Column 1: Progress & Pet */}
          <div className="sv-col sv-col-progress">
            
            <TiltCard className="xp-card">
              <div className="card-title"><Trophy size={18} style={{ color: 'var(--primary)' }} /> {t('student.levelXp')}</div>
              <div className="flex items-center gap-5 mt-4">
                 <div className="text-5xl font-black" style={{ color: 'var(--primary)' }}>{userStats.level}</div>
                 <div className="flex-1">
                   <div className="flex justify-between text-sm font-bold mb-2">
                     <span style={{ color: 'var(--text-muted)' }}>{t('student.progress')}</span>
                     <span style={{ color: 'var(--primary)' }}>{userStats.xp} / {userStats.level * 1000} XP</span>
                   </div>
                   <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--primary-light)' }}>
                     <motion.div
                       className="h-full rounded-full"
                       style={{ background: 'linear-gradient(90deg, var(--primary), #A855F7)' }}
                       initial={{ width: 0 }}
                       animate={{ width: `${Math.min(100, (userStats.xp / (userStats.level * 1000)) * 100)}%` }}
                       transition={{ duration: 1.2, ease: 'easeOut' }}
                     />
                   </div>
                 </div>
              </div>
            </TiltCard>

            <TiltCard className="pet-card">
               <div className="pet-circle">
                 <div className="pet-model">
                    <OliverPet state={getPetState()} size={64} petLevel={userStats.petLevel} equippedItems={userStats.equippedItems} customText={latestParentMessage || undefined} hideBubble={true} hideBadge={true} />
                 </div>
               </div>
               <h3>{t('student.petName')}</h3>
               <p>{t('student.petDesc')}</p>
               <div className="pill-tag pill-secondary mt-2">{t('student.status')}: {getPetState() === 'good' ? t('student.stateHappy') : getPetState() === 'slouch' ? t('student.stateSad') : t('student.stateWarning')}</div>
            </TiltCard>

            <TiltCard className="timer-card">
              <div className="card-title">{t('student.timer')}</div>
              <div className="timer-display">
                 <div className="timer-digit">{hh[0]}</div>
                 <div className="timer-digit">{hh[1]}</div>
                 <div className="timer-colon">:</div>
                 <div className="timer-digit">{mm[0]}</div>
                 <div className="timer-digit">{mm[1]}</div>
                 <div className="timer-colon">:</div>
                 <div className="timer-digit">{ss[0]}</div>
                 <div className="timer-digit">{ss[1]}</div>
              </div>
              <div className="timer-labels">
                <span>{t('student.hr')}</span><span>{t('student.min')}</span><span>{t('student.sec')}</span>
              </div>
              <button className="btn-secondary w-full" onClick={() => resetBreak()}>
                {t('student.newSession')}
              </button>
            </TiltCard>

          </div>

          {/* Column 2: Central Ring & Camera */}
          <div className="sv-col sv-col-camera">
            
            <TiltCard className="ring-card" glowColor={scoreColor}>
              <div className="card-title">{t('student.healthGoal')}</div>
              
              <div className={`score-ring-wrapper ${healthScore >= 80 ? 'score-ring-good' : ''}`}>
                <svg className="score-ring-svg" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="var(--primary-light)" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="44" fill="none"
                    stroke={scoreColor}
                    strokeWidth="6"
                    strokeDasharray="276"
                    strokeDashoffset={276 - (276 * healthScore) / 100}
                    strokeLinecap="round"
                    className="score-ring-progress"
                  />
                </svg>
                <div className="score-ring-text">
                  <span className="score-ring-lbl">PHI SCORE</span>
                  <span className="score-ring-val">{healthScore}</span>
                </div>
                
                <motion.div
                  className="score-play-btn"
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                >
                   <Play size={20} fill="currentColor" />
                </motion.div>
              </div>
              
              <div className="score-footer">
                 {t('student.keepGreen')}
              </div>
            </TiltCard>

            <TiltCard className="camera-card" intensity={3}>
               <div className="camera-header">
                 <div className="card-title">{t('student.cameraAi')}</div>
                 <motion.button
                   onClick={() => setShowCamera(!showCamera)}
                   className={`pill-tag ${showCamera ? 'camera-off-pill' : 'camera-on-pill'}`}
                   whileTap={{ scale: 0.9 }}
                 >
                   {showCamera ? t('student.off') : t('student.on')}
                 </motion.button>
               </div>
               <div className="camera-wrapper relative">
                 {error && showCamera ? (
                   <div className="absolute inset-0 bg-red-950/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-4 z-20" style={{ borderRadius: 'var(--radius-lg)' }}>
                     <AlertTriangle size={32} className="text-red-500 mb-1" />
                     <span className="font-semibold text-red-200 text-xs">{error}</span>
                   </div>
                 ) : null}
                 <video
                    ref={videoRef}
                    className={`camera-video ${!showCamera ? 'hidden' : ''}`}
                    autoPlay playsInline muted
                 />
                 {!showCamera && (
                    <div className="camera-placeholder">
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
            </TiltCard>

          </div>

          {/* Column 3: Leaderboard / Live Stats Table */}
          <div className="sv-col sv-col-stats">
            
            <TiltCard className="leaderboard-card">
               <div className="leaderboard-header">
                  <div className="card-title m-0">{t('student.statusTable')}</div>
                  <motion.div
                    className="pill-tag pill-realtime"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {t('student.live')}
                  </motion.div>
               </div>
               
               <details className="mobile-stats-details" open>
                 <summary className="mobile-stats-summary hidden">{t('student.tapToView')}</summary>

               <div className="table-wrapper">
                 <table className="sv-table">
                   <thead>
                     <tr>
                       <th className="th-left">{t('student.metric')}</th>
                       <th className="th-center">{t('student.goal')}</th>
                       <th className="th-right">{t('student.state')}</th>
                     </tr>
                   </thead>
                   <tbody>
                     <tr>
                       <td className="td-metric">
                         <div className="metric-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>🏃</div>
                         {t('student.distance')}
                       </td>
                       <td className="td-goal">&gt; 50 cm</td>
                       <td className="td-status">
                         <span className={`pill-tag ${metrics && metrics.eyeDistanceCm < 50 ? 'pill-fail' : 'pill-pass'}`}>
                            {metrics ? metrics.eyeDistanceCm : 60} cm
                         </span>
                       </td>
                     </tr>
                     <tr>
                       <td className="td-metric">
                         <div className="metric-icon" style={{ background: 'var(--secondary-light)', color: 'var(--secondary)' }}>🧍</div>
                         {t('student.backSlouch')}
                       </td>
                       <td className="td-goal">&lt; 15°</td>
                       <td className="td-status">
                         <span className={`pill-tag ${metrics && metrics.slouchAngle > 15 ? 'pill-fail' : 'pill-pass'}`}>
                            {metrics ? Math.round(metrics.slouchAngle) : 0}°
                         </span>
                       </td>
                     </tr>
                     <tr>
                       <td className="td-metric">
                         <div className="metric-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>🧘</div>
                         {t('student.neckTilt')}
                       </td>
                       <td className="td-goal">&lt; 20°</td>
                       <td className="td-status">
                         <span className={`pill-tag ${metrics && metrics.neckAngle > 20 && !metrics.isWritingMode ? 'pill-fail' : 'pill-pass'}`}>
                            {metrics ? Math.round(metrics.neckAngle) : 0}°
                         </span>
                       </td>
                     </tr>
                   </tbody>
                 </table>
               </div>
               </details>
             </TiltCard>

            <TiltCard className="tips-card">
              <div className="card-title"><Info size={18} style={{ color: 'var(--primary)' }} /> {t('student.aiHelp')}</div>
              <div className="tips-banner">
                <div className="tips-avatars">
                   {['bg-red-200','bg-green-200','bg-blue-200'].map((c,i)=><div key={i} className={`tip-avatar ${c}`} />)}
                </div>
                <div className="tips-text">
                  {t('student.aiTipsCount')}
                  <div className="tips-subtext">{t('student.aiTipsDesc')}</div>
                </div>
              </div>
              <motion.button
                className="btn-3d btn-3d-secondary w-full"
                onClick={() => setShowTips(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                <span dangerouslySetInnerHTML={{ __html: t('student.viewTips') }}></span>
              </motion.button>
            </TiltCard>

          </div>

        </div>
      </div>
    </div>
  );
};

export default StudentView;
