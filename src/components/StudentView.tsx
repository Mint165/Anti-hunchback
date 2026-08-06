// Student Workspace — Asymmetric adventure dashboard (redesigned).
// All logic/lifecycle/overlay behaviour preserved from the previous
// implementation; only layout + styling changed.

import React, { useState, useEffect, useRef } from 'react';
import { useMediaQuery } from 'react-responsive';
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
  Smartphone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CalibrationData } from '../services/postureAI';
import { loadUserStats, loadSettings, saveSettings, saveSessionRecord, addXP, getBadgesStatus, getUserIdSync } from '../services/db';
import type { Badge } from '../services/db';
import { broadcastStudentStatus, broadcastFatigueAlert, broadcastCameraOffAlert } from '../services/parentSync';
import { usePostureContext } from '../contexts/PostureContext';
import { useLanguage } from '../contexts/LanguageContext';
import { voiceService } from '../services/voiceService';
import Calibration from './Calibration';
import BackboneVisualizer from './BackboneVisualizer';
import AuxSkeletonOverlay from './AuxSkeletonOverlay';
import MobileCameraView from './MobileCameraView';
import TiltCard from './ui/TiltCard';
import StatRing from './ui/StatRing';
import AnimatedCounter from './ui/AnimatedCounter';
import styles from './StudentView.module.css';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

// Static SVG pet avatar — lightweight alternative to the 3D OliverPet
// in the mini card. Avoids spawning a second WebGL context on the
// Student dashboard (each context is expensive). Now extracted to its
// own module (PetAvatarSVG.tsx) so FloatingPet can reuse it during
// camera-active study sessions — see the comment there for why we
// avoid a third WebGL context (Pose + FaceMesh + OliverPet) when the
// camera is on.
import { PetAvatarSVG } from './PetAvatarSVG';
import type { PetState } from './OliverPet';

export const StudentView: React.FC = () => {
  // Outer wrapper: decide mobile vs desktop BEFORE any of the inner
  // component's hooks run. The previous structure had
  //   const isMobile = useMediaQuery(...);
  //   ... lots of hooks ...
  //   if (isMobile) return <MobileCameraView />;
  // which violates the Rules of Hooks: when `isMobile` flips between
  // renders (e.g. user rotates a hybrid device, or the media query
  // resolves one frame later), the number of hooks React recorded
  // changes mid-tree and React throws minified error #310 ("Rendered
  // fewer hooks than expected"). Splitting the mobile/desktop decision
  // into a hook-free wrapper keeps the inner component's hook order
  // stable regardless of viewport changes.
  const isMobile = useMediaQuery({ maxWidth: 768 });
  if (isMobile) return <MobileCameraView />;
  return <StudentViewInner />;
};

const StudentViewInner: React.FC = () => {
  const {
    metrics, healthScore, alertLevel, hasStarted, startSession, resetBreak,
    isModelReady, isLoading, error, calibration, setCalibration,
    poseLandmarks, faceLandmarks,
    sessionFatigueFlags, sessionAngleAccumulator,
    isManualWritingMode,
    setIsManualWritingMode,
    isCameraActive,
    pauseCamera,
    resumeCamera,
    auxPoseLandmarks,
    auxCameraDeviceId,
    phoneCameraReady,
    phoneCameraDeviceId,
    auxPairingAccepted,
    requestPhonePairing,
    dismissPhonePairing,
    otherActiveDevices,
    isDesktop,
    eyeExerciseTriggered,
  } = usePostureContext();
  const { t } = useLanguage();

  // Task D + E.3 — mobile is handled by the outer StudentView wrapper
  // above; this inner component is desktop-only. The desktop pair
  // prompt below is gated on `isDesktop` from context (which is always
  // true here) so we don't need a separate useMediaQuery read.
  // Local dismiss flag so the user can hide the desktop pair prompt
  // without cancelling the underlying phone_camera_ready broadcast
  // (the phone is still ready; we just don't want to nag the user).
  const [pairPromptDismissed, setPairPromptDismissed] = useState<boolean>(false);
  // Show the desktop prompt when: this is the desktop, a phone on the
  // same account is detected (either via the explicit
  // `phone_camera_ready` heartbeat OR via presence — presence covers
  // the case where the phone is online but its camera failed to start,
  // which was the root cause of the prompt never appearing), the user
  // hasn't already accepted (auxPairingAccepted flips true on the
  // phone's ack), and the user hasn't dismissed the prompt for this
  // phone-ready session. Also gate on `!auxPoseLandmarks` so once
  // streaming is live we hide the prompt — the split-screen UI itself
  // is the visible signal.
  const phonePresent = phoneCameraReady || otherActiveDevices.some((d) => !d.isDesktop);
  const showPairPrompt =
    isDesktop && phonePresent && !auxPairingAccepted &&
    !pairPromptDismissed && !auxPoseLandmarks;

  // Reset the local dismiss flag whenever a new phone becomes ready
  // (different device id) so the prompt can re-appear for a new phone
  // even if the user dismissed it for a previous one.
  const lastPhoneDeviceRef = useRef<string | null>(null);
  useEffect(() => {
    if (phoneCameraDeviceId !== lastPhoneDeviceRef.current) {
      lastPhoneDeviceRef.current = phoneCameraDeviceId;
      setPairPromptDismissed(false);
    }
  }, [phoneCameraDeviceId]);

  // If the phone goes away or pairing is accepted, drop the dismiss
  // flag so a future phone re-shows the prompt.
  useEffect(() => {
    if (!phoneCameraReady) setPairPromptDismissed(false);
  }, [phoneCameraReady]);

  // Surface a toast when the phone explicitly rejects the pairing
  // (camera failed to start on the phone side). The PostureContext
  // resets `auxPairingAccepted` to false on a rejection, but without
  // this toast the desktop user has no feedback — the prompt just
  // stays on screen and they assume nothing happened. Track the
  // previous value so we only fire the toast on a true → false edge
  // after a request, not on the initial false → false.
  const prevAcceptedRef = useRef<boolean>(false);
  useEffect(() => {
    // Only fire when we transition from "we asked" (prompt was
    // visible / accepted was tentatively true) back to false. The
    // phone sets accepted=true optimistically then the landmarks
    // either arrive (and we hide the prompt) or don't (and the 5s
    // aux-landmark expiry reverts us). The explicit `accepted=false`
    // response is the clearest signal — fire on that edge.
    if (prevAcceptedRef.current && !auxPairingAccepted) {
      toast.error(t('student.pairRejectedPhoneFailed'), { duration: 5000 });
    }
    prevAcceptedRef.current = auxPairingAccepted;
  }, [auxPairingAccepted, t]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  // `showCamera` is now derived from the real camera state in context. We
  // keep a local mirror only so the calibration / pre-start video preview
  // element (which exists before the session starts) can still toggle its
  // own visibility without touching the global MediaPipe stream.
  const showCamera = isCameraActive;
  // Initialize the audio-enable flag from the persisted Settings value
  // so the Settings panel's "Warning Sound" toggle actually controls
  // whether the STRONG_WARNING chime + voice reminder play. Previously
  // this was hardcoded to `true` and the Settings toggle was a no-op.
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(() => {
    try {
      return loadSettings().soundAlertEnabled;
    } catch {
      return true;
    }
  });
  // Sync back to the persisted settings store (and Supabase via
  // saveSettings) so the Settings panel's "Warning Sound" toggle stays
  // in sync when the user toggles from the dashboard speaker button.
  useEffect(() => {
    try {
      const s = loadSettings();
      if (s.soundAlertEnabled !== isAudioEnabled) {
        saveSettings({ ...s, soundAlertEnabled: isAudioEnabled });
      }
    } catch {}
  }, [isAudioEnabled]);
  const [showTips, setShowTips] = useState<boolean>(false);

  // Track the previous camera state so we only broadcast on actual
  // transitions, not on every re-render that reads isCameraActive.
  const prevCameraActiveRef = useRef<boolean>(isCameraActive);
  useEffect(() => {
    if (prevCameraActiveRef.current === isCameraActive) return;
    const became = isCameraActive ? 'on' : 'off';
    prevCameraActiveRef.current = isCameraActive;
    // Only broadcast when a real session is in progress — toggling the
    // camera during calibration / pre-start would be noise to the parent.
    if (!hasStarted || !calibration) return;
    if (became === 'off') {
      broadcastCameraOffAlert(t('notifications.cameraOffMsg'), 'off', getUserIdSync());
    } else {
      broadcastCameraOffAlert(t('notifications.cameraOnMsg'), 'on', getUserIdSync());
    }
  }, [isCameraActive, hasStarted, calibration, t]);

  // When the camera is actually stopped (Task 7), the global video element's
  // srcObject is cleared by useMediaPipe. Mirror that to the local preview
  // element so the last frame doesn't linger behind the placeholder, and
  // restore it when the camera comes back on.
  useEffect(() => {
    if (!videoRef.current) return;
    if (!isCameraActive) {
      videoRef.current.srcObject = null;
    } else {
      const globalVideo = document.getElementById('global-webcam') as HTMLVideoElement | null;
      if (globalVideo && videoRef.current.srcObject !== globalVideo.srcObject) {
        videoRef.current.srcObject = globalVideo.srcObject;
      }
    }
  }, [isCameraActive]);

  const handleToggleCamera = () => {
    if (isCameraActive) {
      pauseCamera();
    } else {
      resumeCamera();
    }
  };

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
    // Safety-net poll for stream re-attachments. The `loadedmetadata` /
    // `play` events above already cover the common camera-on path, so
    // the interval only needs to catch rare edge cases — 5s is enough
    // resolution for that and avoids firing a redundant srcObject
    // comparison every 2s while the camera is running (each tick
    // interrupts the main thread during MediaPipe inference).
    const interval = setInterval(syncStream, 5000);
    return () => {
      globalVideo.removeEventListener('loadedmetadata', syncStream);
      globalVideo.removeEventListener('play', syncStream);
      clearInterval(interval);
    };
  }, [showCamera, hasStarted, isModelReady, isCameraActive]);

  useEffect(() => {
    if (!hasStarted) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
      setSessionElapsedSeconds(elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime, hasStarted]);

  useEffect(() => {
    if (eyeExerciseTriggered) return;
    if (alertLevel === 'STRONG_WARNING') {
      warningsCountRef.current += 1;
      if (isAudioEnabled) playBeepSound();
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    }
  }, [alertLevel, isAudioEnabled, eyeExerciseTriggered]);

  const lastBroadcastRef = useRef<number>(0);

  useEffect(() => {
    if (!isModelReady || !calibration || !metrics) return;
    totalTicksRef.current += 1;
    if (healthScore >= 80) goodPostureCountRef.current += 1;
    if (metrics.isBlinking) blinkCountRef.current += 1;
    if (metrics.fidgetFactor > 40 && totalTicksRef.current > 0 && totalTicksRef.current % 300 === 0) {
      fidgetCountRef.current += 1;
      broadcastFatigueAlert(t('student.fidgetAlert'), getUserIdSync());
    }
    const now = Date.now();
    if (now - lastBroadcastRef.current >= 5000) {
      const overallStatus = healthScore >= 85 ? 'good' : healthScore >= 70 ? 'warning' : 'danger';
      broadcastStudentStatus(overallStatus, {
        eyeDistanceCm: metrics.eyeDistanceCm,
        neckAngle: metrics.neckAngle,
        shoulderTilt: metrics.shoulderTilt,
        slouchAngle: metrics.slouchAngle,
        healthScore: healthScore,
        isWritingMode: metrics.isWritingMode,
      }, getUserIdSync());
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

  // ⚠️ Rules of Hooks: throttledMetrics MUST be declared BEFORE the
  // `if (!calibration)` early return below. Previously it sat *after*
  // the early return, which meant React saw a different hook count
  // before vs. after calibration completed — and the moment the user
  // finished their first calibration, the hook tree changed mid-flight
  // and React threw minified error #300 ("Rendered fewer hooks than
  // expected"). Declaring it here, alongside the other dashboard
  // state, keeps the hook order stable across the calibration →
  // dashboard transition.
  const [throttledMetrics, setThrottledMetrics] = useState(metrics);
  useEffect(() => {
    const id = window.setInterval(() => {
      setThrottledMetrics(metrics);
    }, 2000);
    return () => window.clearInterval(id);
  }, [metrics]);

  const handleFinishOnboarding = () => {
    localStorage.setItem('oliver_onboarded', 'true');
    setShowOnboarding(false);
  };

  // ── Onboarding overlay ────────────────────────────────────────────
  if (!calibration) {
    if (showOnboarding) {
      return (
        <motion.div
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center text-center p-8 ${styles.fullScreenOverlay}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
            style={{ background: 'color-mix(in srgb, var(--primary) 20%, transparent)' }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
          >
            <Trophy size={48} style={{ color: 'var(--primary)' }} />
          </motion.div>
          <motion.h2
            className="text-5xl font-black mb-4 tracking-tight"
            style={{ color: 'var(--text-main)' }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {t('student.welcomeTitle')}
          </motion.h2>
          <motion.p
            className="text-xl mb-10 max-w-lg leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
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
        <div className="calibration-card">
          <h2 className="calibration-title">{t('student.startSessionTitle')}</h2>
          <p className="calibration-desc">{t('student.startSessionDesc')}</p>
          <div className="calibration-video-wrapper relative">
            <video ref={videoRef} className="calibration-video" autoPlay playsInline muted />
            {error ? (
              <div className="absolute inset-0 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 rounded-3xl z-10" style={{ background: 'var(--scrim-danger)' }}>
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
  // The status table (Distance / Back Slouch / Neck Tilt) reads from
  // `throttledMetrics` (declared above, before the calibration early
  // return) so the bars only repaint at ~0.5 Hz (every 2 s) instead
  // of following the ~2 Hz PostureContext metrics state. The raw
  // `metrics` still feeds the alert engine and PHI score, so posture
  // detection / warnings remain responsive — only the visible bar
  // animation is throttled further, which keeps the page visibly
  // smoother. The CSS `transition: width 500ms` on each bar still
  // produces a smooth slide between snapshots.
  const distanceValue = throttledMetrics ? throttledMetrics.eyeDistanceCm : 60;
  const distancePass = distanceValue >= 50;
  const slouchValue = throttledMetrics ? Math.round(throttledMetrics.slouchAngle) : 0;
  const slouchPass = slouchValue <= 15;
  const neckValue = throttledMetrics ? Math.round(throttledMetrics.neckAngle) : 0;
  const neckPass = throttledMetrics ? (throttledMetrics.neckAngle <= 20 || throttledMetrics.isWritingMode) : true;

  return (
    <div className={`${styles.container} ${alertLevel === 'MILD_WARNING' ? 'screen-alert-glow' : ''}`}>
      {/* ── Tips modal ──────────────────────────────────────────────── */}
      {showTips && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--scrim)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
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
            className={`fixed inset-0 z-[60] flex flex-col items-center justify-center text-center p-8 ${styles.fullScreenOverlay}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.h2
              className="text-5xl font-black mb-4 tracking-tight"
              style={{ color: 'var(--text-main)' }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              {t('student.readyTitle')}
            </motion.h2>
            <motion.p
              className="text-xl mb-10 max-w-lg leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
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
        <div className="fixed inset-0 z-50 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-8" style={{ background: 'var(--scrim-strong)', color: 'var(--text-main)' }}>
          <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-pulse" style={{ background: 'color-mix(in srgb, var(--secondary) 20%, transparent)', color: 'var(--secondary)' }}>
            <BookOpen size={48} />
          </div>
          <h2 className="text-5xl font-black mb-4 tracking-tight">{t('student.breakTitle')}</h2>
          <p className="text-xl mb-10 max-w-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('student.breakDesc')}</p>
          <button onClick={() => resetBreak()} className="btn-secondary text-lg px-10 py-4" style={{ boxShadow: '0 8px 32px var(--secondary)' }}>
            {t('student.breakBtn')}
          </button>
        </div>
      )}

      {/* ── Strong warning overlay ─────────────────────────────────── */}
      {alertLevel === 'STRONG_WARNING' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--scrim-danger)' }}>
          <div className="premium-card p-10 max-w-lg subtle-pulse relative" style={{ border: `2px solid var(--danger)`, boxShadow: '0 0 80px var(--danger-glow)' }}>
            <AlertTriangle size={72} className="mx-auto mb-6" style={{ color: 'var(--danger)', filter: 'drop-shadow(0 0 15px var(--danger-glow))' }} />
            <h2 className="text-4xl font-black text-center mb-4" style={{ color: 'var(--text-main)' }}>{t('student.dangerTitle')}</h2>
            <p className="text-center text-lg mb-8 leading-relaxed font-medium" style={{ color: 'var(--text-main)' }}>{t('student.dangerDesc')}</p>
            <button onClick={() => resetBreak()} className="btn-primary w-full py-4 text-lg font-bold" style={{ background: 'var(--danger)', color: 'white', border: 'none' }}>
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
              onClick={handleToggleCamera}
              className={`${styles.cameraToggle} ${showCamera ? styles.cameraToggleOff : styles.cameraToggleOn}`}
              whileTap={{ scale: 0.9 }}
            >
              {showCamera ? t('student.off') : t('student.on')}
            </motion.button>
          </div>
          {/* Task D — desktop-initiated camera pairing prompt. Shown
              when a phone on the same account has its camera on and
              ready, the user hasn't accepted/dismissed yet, and no aux
              landmarks are already streaming. Tapping "Đồng ý ghép đôi"
              broadcasts aux_pairing_request; the phone responds and
              starts streaming, after which auxPoseLandmarks becomes
              non-null and the split-view block below takes over. */}
          {showPairPrompt && (
            <div className={styles.pairPrompt} role="status">
              <Smartphone size={18} aria-hidden="true" />
              <span className={styles.pairPromptText}>
                {auxPairingAccepted
                  ? t('student.pairCameraPaired')
                  : t('student.pairCameraPrompt')}
              </span>
              {!auxPairingAccepted && (
                <>
                  <button
                    type="button"
                    className={styles.pairPromptBtn}
                    onClick={() => requestPhonePairing()}
                  >
                    {t('student.pairCameraAccept')}
                  </button>
                  <button
                    type="button"
                    className={styles.pairPromptBtn}
                    style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
                    onClick={() => {
                      dismissPhonePairing();
                      setPairPromptDismissed(true);
                    }}
                    aria-label={t('student.pairCameraDismiss')}
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          )}
          {/* Task F — desktop: when an aux phone is streaming landmarks,
              split the camera card into two columns: front camera + spine
              overlay on the left, ghost aux skeleton on the right. The 5s
              aux-expiry watchdog in PostureContext will null out
              auxPoseLandmarks when the phone stops, which auto-reverts
              this to the single-column layout. Mobile never gets here
              because the phone renders MobileCameraView instead. */}
          {isDesktop && auxPoseLandmarks && auxCameraDeviceId ? (
            <div className={styles.cameraSplit}>
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
              <AuxSkeletonOverlay
                landmarks={auxPoseLandmarks}
                label={t('student.auxLabel')}
              />
            </div>
          ) : (
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
          )}
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
            <div className={styles.livePill}>
              {t('student.live')}
            </div>
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
              {/* Plain div + CSS transition instead of framer-motion: the bar
                  re-renders on every MediaPipe frame (~10 FPS) and animating
                  width via motion.div was forcing a re-evaluation of the
                  framer-motion tree on each frame. The CSS transition is
                  GPU-composited and decoupled from React's render cycle. */}
              <div
                className={styles.statBarFill}
                style={{
                  background: distancePass ? 'var(--secondary)' : 'var(--danger)',
                  width: `${Math.min(100, (distanceValue / 80) * 100)}%`,
                  transition: 'width 500ms ease',
                }}
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
              <div
                className={styles.statBarFill}
                style={{
                  background: slouchPass ? 'var(--secondary)' : 'var(--danger)',
                  width: `${Math.min(100, (slouchValue / 30) * 100)}%`,
                  transition: 'width 500ms ease',
                }}
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
              <div
                className={styles.statBarFill}
                style={{
                  background: neckPass ? 'var(--secondary)' : 'var(--danger)',
                  width: `${Math.min(100, (neckValue / 40) * 100)}%`,
                  transition: 'width 500ms ease',
                }}
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
                showCount={false}
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
            {/* Plain div + CSS transition: the XP bar re-renders when
                userStats.xp changes (after each session / exercise
                reward). framer-motion was re-evaluating its tree on
                every prop change for a one-shot animation that a CSS
                transition handles identically. */}
            <div
              className={styles.xpBarFill}
              style={{
                width: `${Math.min(100, (userStats.xp / (userStats.level * 1000)) * 100)}%`,
                transition: 'width 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
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