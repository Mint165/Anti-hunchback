// Student Workspace Component

import React, { useState, useEffect, useRef } from 'react';
import { Check, Shield, AlertTriangle, RefreshCw, Trophy, BookOpen, Volume2, VolumeX, Camera, CameraOff } from 'lucide-react';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { analyzePosture, calculateHealthScore } from '../services/postureAI';
import type { CalibrationData, PostureMetrics } from '../services/postureAI';
import { loadCalibration, loadSettings, loadUserStats, saveSessionRecord, addXP, getBadgesStatus } from '../services/db';
import type { Badge } from '../services/db';
import { broadcastStudentStatus, broadcastFatigueAlert } from '../services/parentSync';
import OliverPet from './OliverPet';
import type { PetState } from './OliverPet';
import Calibration from './Calibration';
import EyeExercise from './EyeExercise';

export const StudentView: React.FC = () => {
  const {
    poseLandmarks,
    faceLandmarks,
    isLoading,
    startCamera,
    stopCamera,
    isModelReady,
  } = useMediaPipe();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [metrics, setMetrics] = useState<PostureMetrics | null>(null);
  const [healthScore, setHealthScore] = useState<number>(100);
  const [showCamera, setShowCamera] = useState<boolean>(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);

  // States for timers and notifications
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [totalSessionMinutes, setTotalSessionMinutes] = useState<number>(0);
  const [badPostureSeconds, setBadPostureSeconds] = useState<number>(0);
  const [alertLevel, setAlertLevel] = useState<'none' | 'light' | 'strong'>('none');
  const [stretchBreakTriggered, setStretchBreakTriggered] = useState<boolean>(false);
  const [eyeExerciseTriggered, setEyeExerciseTriggered] = useState<boolean>(false);

  // Statistics accumulators for the session
  const [warningsCount, setWarningsCount] = useState<number>(0);
  const [blinkCount, setBlinkCount] = useState<number>(0);
  const [fidgetCount, setFidgetCount] = useState<number>(0);
  const [goodPostureCount, setGoodPostureCount] = useState<number>(0);
  const [totalTicks, setTotalTicks] = useState<number>(0);

  // Gamification states
  const [userStats, setUserStats] = useState(loadUserStats());
  const [badges, setBadges] = useState<Badge[]>(getBadgesStatus());

  // Movement history for fidget calculation
  const movementHistoryRef = useRef<{ x: number; y: number }[]>([]);

  // Load calibration and settings on mount
  useEffect(() => {
    const savedCalibration = loadCalibration();
    if (savedCalibration.baseEyeDistance !== 80 || localStorage.getItem('oliver_calibration_data')) {
      setCalibration(savedCalibration);
    }
  }, []);

  // Sync webcam stream to video element when model is ready
  useEffect(() => {
    if (isModelReady && videoRef.current) {
      startCamera(videoRef.current);
    }
    return () => stopCamera();
  }, [isModelReady, startCamera, stopCamera]);

  // Session Duration Timer
  useEffect(() => {
    const interval = setInterval(() => {
      const mins = Math.floor((Date.now() - sessionStartTime) / 60000);
      setTotalSessionMinutes(mins);

      const settings = loadSettings();
      if (mins > 0 && mins % settings.sessionBreakInterval === 0 && !stretchBreakTriggered) {
        setStretchBreakTriggered(true);
        playStretchSound();
      }

      const secs = Math.floor((Date.now() - sessionStartTime) / 1000);
      if (secs > 0 && secs % (settings.eyeExerciseInterval * 60) === 0 && !eyeExerciseTriggered) {
        setEyeExerciseTriggered(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStartTime, stretchBreakTriggered, eyeExerciseTriggered]);

  // Main real-time AI processing loop
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

    const calculatedScore = calculateHealthScore(calculatedMetrics);
    setHealthScore(calculatedScore);

    setTotalTicks(t => t + 1);
    if (calculatedScore >= 80) {
      setGoodPostureCount(g => g + 1);
    }

    if (calculatedMetrics.isBlinking) {
      setBlinkCount(b => b + 1);
    }

    if (calculatedMetrics.fidgetFactor > 40 && totalTicks > 0 && totalTicks % 300 === 0) {
      setFidgetCount(f => f + 1);
      broadcastFatigueAlert("Bé bắt đầu nhấp nhổm nhiều, có dấu hiệu mất tập trung hoặc mỏi cơ.");
    }

    const settings = loadSettings();
    const isUnderDistance = calculatedMetrics.eyeDistanceCm < settings.screenDistanceThreshold;
    const isBentNeck = calculatedMetrics.neckAngle > settings.neckTiltThreshold;
    const isCrookedShoulder = calculatedMetrics.shoulderTilt > settings.shoulderTiltThreshold;
    const isSlouchedBack = calculatedMetrics.slouchAngle > settings.slouchThreshold;

    const hasIssue = (isUnderDistance || isCrookedShoulder || isSlouchedBack || (isBentNeck && !calculatedMetrics.isWritingMode));

    if (hasIssue) {
      setBadPostureSeconds(s => s + 1);
    } else {
      setBadPostureSeconds(0);
      setAlertLevel('none');
    }

    if (badPostureSeconds >= 30 && badPostureSeconds < 120) {
      setAlertLevel('light');
    } else if (badPostureSeconds >= 120) {
      if (alertLevel !== 'strong') {
        setAlertLevel('strong');
        setWarningsCount(w => w + 1);
        if (isAudioEnabled && settings.soundAlertEnabled) {
          playBeepSound();
        }
      }
    }

    const overallStatus = calculatedScore >= 85 ? 'good' : calculatedScore >= 70 ? 'warning' : 'danger';
    broadcastStudentStatus(overallStatus, {
      eyeDistanceCm: calculatedMetrics.eyeDistanceCm,
      neckAngle: calculatedMetrics.neckAngle,
      shoulderTilt: calculatedMetrics.shoulderTilt,
      slouchAngle: calculatedMetrics.slouchAngle,
      healthScore: calculatedScore,
      isWritingMode: calculatedMetrics.isWritingMode,
    });

  }, [poseLandmarks, faceLandmarks, isModelReady, calibration, badPostureSeconds, alertLevel, isAudioEnabled, totalTicks]);

  const playBeepSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  const playStretchSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playFreq = (freq: number, start: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + start + 0.3);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + 0.3);
      };
      playFreq(440, 0);
      playFreq(554, 0.15);
      playFreq(659, 0.3);
    } catch {}
  };

  const getPetState = (): PetState => {
    if (eyeExerciseTriggered) return 'tired';
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

  const handleEyeExerciseComplete = (xpGained: number) => {
    setEyeExerciseTriggered(false);
    if (xpGained > 0) {
      setUserStats(loadUserStats());
      setBadges(getBadgesStatus());
    }
  };

  const handleEndSession = () => {
    if (totalTicks === 0) return;

    const goodPosturePercentage = Math.round((goodPostureCount / totalTicks) * 100);
    const sessionRecord = {
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString().split('T')[0],
      startTime: sessionStartTime,
      endTime: Date.now(),
      durationMinutes: Math.max(1, totalSessionMinutes),
      averageHealthScore: Math.round(healthScore),
      goodPosturePercentage,
      warningsCount,
      blinksCount: blinkCount,
      fidgetFlagsCount: fidgetCount,
      completedEyeExercises: Math.floor(totalSessionMinutes / 20),
      streakAdded: true,
    };
    saveSessionRecord(sessionRecord);

    if (goodPosturePercentage > 80 && totalSessionMinutes >= 5) {
      addXP(500);
      const isNew = badges.find(b => b.id === 'warrior')?.unlocked === false;
      if (isNew) {
        localStorage.setItem('oliver_unlocked_badge_warrior', 'true');
        addXP(1000);
      }
    }

    setSessionStartTime(Date.now());
    setTotalSessionMinutes(0);
    setWarningsCount(0);
    setBlinkCount(0);
    setFidgetCount(0);
    setGoodPostureCount(0);
    setTotalTicks(0);
    setUserStats(loadUserStats());
    setBadges(getBadgesStatus());
    alert('Buổi học đã hoàn thành! Dữ liệu đã được lưu trữ và đồng bộ.');
  };

  // ── Calibration Screen ──────────────────────────────────────────
  if (!calibration) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-8"
        style={{ background: 'linear-gradient(145deg, #f0fdf4 0%, #eff6ff 100%)' }}>
        <div className="relative w-80 h-56 bg-gray-900 rounded-3xl overflow-hidden shadow-2xl mb-6 border-4 border-white">
          <video
            ref={videoRef}
            className="w-full h-full object-cover scale-x-[-1]"
            autoPlay
            playsInline
            muted
          />
          {isLoading && (
            <div className="absolute inset-0 bg-gray-900/75 flex flex-col items-center justify-center text-white gap-3">
              <div className="w-8 h-8 border-3 border-green-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold">Đang tải AI Engine...</span>
            </div>
          )}
        </div>
        <Calibration
          poseLandmarks={poseLandmarks}
          faceLandmarks={faceLandmarks}
          onCalibrationComplete={handleCalibrationComplete}
          isModelReady={isModelReady}
        />
      </div>
    );
  }

  // ── PHI Score ring color helper
  const scoreColor = healthScore >= 80 ? '#4ADE80' : healthScore >= 60 ? '#FBBF24' : '#FF5E5E';
  const scoreRingOffset = 289 - (289 * healthScore) / 100;
  const hoursLogged = Math.round(userStats.totalStudyTime / 60);
  const hh = Math.floor(totalSessionMinutes / 60).toString().padStart(2, '0');
  const mm = (totalSessionMinutes % 60).toString().padStart(2, '0');

  // ── Main Dashboard ──────────────────────────────────────────────
  return (
    <div
      className={`min-h-full p-6 lg:p-8 ${alertLevel === 'light' ? 'screen-alert-glow' : ''} ${alertLevel === 'strong' ? 'shake-warn' : ''}`}
      style={{ background: 'var(--bg-page)' }}
    >
      {/* Eye Exercise Overlay */}
      {eyeExerciseTriggered && (
        <EyeExercise
          isBlinking={metrics?.isBlinking || false}
          onComplete={handleEyeExerciseComplete}
        />
      )}

      {/* Stretch Break Lock Screen */}
      {stretchBreakTriggered && (
        <div className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-2xl flex flex-col items-center justify-center text-white text-center p-8">
          <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 mb-6 animate-pulse">
            <BookOpen size={48} />
          </div>
          <h2 className="text-4xl font-extrabold mb-4">Đã Học Liên Tục 45 Phút!</h2>
          <p className="text-gray-300 text-lg mb-8 max-w-md">
            Cơ thể của bạn cần nghỉ ngơi. Hãy đứng dậy vươn vai, đi uống nước hoặc vận động nhẹ trong 1–2 phút nhé!
          </p>
          <button
            onClick={() => setStretchBreakTriggered(false)}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-2xl shadow-md transition-all"
          >
            Tôi đã vận động xong
          </button>
        </div>
      )}

      {/* Strong Warn Overlay */}
      {alertLevel === 'strong' && (
        <div className="fixed inset-0 z-40 bg-red-900/40 backdrop-blur-md flex flex-col items-center justify-center text-white text-center p-4">
          <div className="glass-card border border-red-500 bg-red-950/40 p-8 rounded-3xl max-w-md shadow-2xl animate-bounce">
            <AlertTriangle size={64} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-3xl font-black mb-2">TƯ THẾ SAI NGHIÊM TRỌNG</h2>
            <p className="text-red-100 text-base mb-6">
              Bạn đã ngồi sai tư thế liên tục hơn 2 phút! Hãy điều chỉnh lại khoảng cách và thẳng lưng ngay để bảo vệ cột sống và thị lực.
            </p>
            <button
              onClick={() => { setAlertLevel('none'); setBadPostureSeconds(0); }}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition-all"
            >
              Tôi Đã Sửa Tư Thế
            </button>
          </div>
        </div>
      )}

      {/* ── Dashboard Grid ───────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto">

        {/* Header row */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-800 leading-tight">Dashboard Học Tập</h1>
            <p className="text-sm text-gray-400 font-medium mt-0.5">Theo dõi tư thế & sức khỏe học đường theo thời gian thực</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              className={`nav-action-btn ${isAudioEnabled ? 'active' : ''}`}
              title={isAudioEnabled ? 'Tắt âm thanh cảnh báo' : 'Bật âm thanh cảnh báo'}
            >
              {isAudioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              onClick={() => setCalibration(null)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 hover:text-green-700 transition-all rounded-xl"
              style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}
            >
              <RefreshCw size={14} /> Hiệu chỉnh lại
            </button>
          </div>
        </div>

        {/* 3-Column Masonry Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">

          {/* ══ COLUMN 1 ════════════════════════════════════ */}
          <div className="flex flex-col gap-5">

            {/* Widget: 7-Day Snapshot */}
            <div className="widget-card p-6">
              <h3 className="widget-label flex items-center gap-2 mb-5">
                📅 Tổng Kết 7 Ngày
              </h3>
              <div className="space-y-4">
                {/* Hours */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #fef9c3, #fef08a)', color: '#d97706', border: '1px solid #fde68a' }}>
                    {hoursLogged}
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-extrabold text-gray-800">Giờ học</div>
                    <div className="text-xs font-semibold text-gray-400">Đã ghi nhận</div>
                  </div>
                  <div className="text-sm font-bold" style={{ color: '#4ADE80' }}>↗ 8%</div>
                </div>

                {/* Streak */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #fef9c3, #fef08a)', color: '#d97706', border: '1px solid #fde68a' }}>
                    {userStats.streak}
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-extrabold text-gray-800">Chuỗi ngày</div>
                    <div className="text-xs font-semibold text-gray-400">Liên tiếp hoàn thành</div>
                  </div>
                  <div className="text-sm font-bold" style={{ color: '#FF5E5E' }}>↘ -5%</div>
                </div>

                {/* Level */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #fef9c3, #fef08a)', color: '#d97706', border: '1px solid #fde68a' }}>
                    {userStats.level}
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-extrabold text-gray-800">Cấp độ</div>
                    <div className="text-xs font-semibold text-gray-400">Xếp hạng hiện tại</div>
                  </div>
                  <div className="text-sm font-bold" style={{ color: '#4ADE80' }}>↗ 10%</div>
                </div>
              </div>
            </div>

            {/* Widget: Session Timer & Rank */}
            <div className="widget-card p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-extrabold text-gray-800">Phiên Học</h3>
                <span className="w-8 h-8 rounded-xl font-bold text-sm text-white flex items-center justify-center shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', border: '2px solid #fde68a' }}>
                  {userStats.level}
                </span>
              </div>

              {/* Stats row */}
              <div className="flex justify-between items-center mb-5 pb-5" style={{ borderBottom: '1px solid #F3F4F6' }}>
                <div className="text-center">
                  <div className="text-2xl font-black text-gray-800">{userStats.streak}</div>
                  <div className="widget-label mt-1">Ngày</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-gray-800">{hoursLogged}</div>
                  <div className="widget-label mt-1">Giờ</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-gray-800">{userStats.badges.length}</div>
                  <div className="widget-label mt-1">Huy hiệu</div>
                </div>
              </div>

              {/* Timer digits */}
              <div className="flex flex-col items-center mb-5">
                <div className="widget-label mb-3">Thời gian phiên học</div>
                <div className="flex gap-2 font-black text-gray-800 font-mono text-2xl">
                  {[hh[0], hh[1]].map((d, i) => (
                    <div key={`h${i}`} className="w-11 h-13 rounded-xl flex items-center justify-center"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)' }}>
                      {d}
                    </div>
                  ))}
                  <span className="pt-1 text-gray-300">:</span>
                  {[mm[0], mm[1]].map((d, i) => (
                    <div key={`m${i}`} className="w-11 h-13 rounded-xl flex items-center justify-center"
                      style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)' }}>
                      {d}
                    </div>
                  ))}
                </div>
                <div className="flex gap-14 mt-2 widget-label">
                  <span>Giờ</span><span>Phút</span>
                </div>
              </div>

              <button
                onClick={handleEndSession}
                className="w-full py-3.5 font-bold text-white rounded-2xl shadow-md transition-all flex justify-center items-center gap-2 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #4ADE80, #22c55e)', boxShadow: '0 4px 12px rgba(74, 222, 128, 0.35)' }}
              >
                <RefreshCw size={16} /> Kết thúc & Đồng bộ
              </button>
            </div>

            {/* Widget: Badges */}
            <div className="widget-card p-6">
              <h3 className="widget-label flex items-center gap-2 mb-5">
                <Trophy size={14} /> Huy Hiệu Đạt Được
              </h3>
              <div className="space-y-3">
                {badges.map((badge) => (
                  <div key={badge.id} className="flex items-center gap-3 pb-3 last:pb-0" style={{ borderBottom: '1px solid #F9FAFB' }}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0`}
                      style={{ background: badge.unlocked ? '#ede9fe' : '#F3F4F6', color: badge.unlocked ? '#7c3aed' : '#9CA3AF' }}>
                      {badge.unlocked ? <Check size={15} /> : <Shield size={15} />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-gray-800 truncate">{badge.name}</div>
                      <div className="text-xs text-gray-400 truncate">{badge.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ══ COLUMN 2 ════════════════════════════════════ */}
          <div className="flex flex-col gap-5">

            {/* Achievement Toast */}
            <div className="widget-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 relative overflow-hidden rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#f5f3ff', border: '1px solid #e9d5ff' }}>
                  <div className="scale-75 origin-center -translate-y-1">
                    <OliverPet state={getPetState()} size={56} />
                  </div>
                </div>
                <div>
                  <div className="widget-label">Thành tích mới</div>
                  <div className="text-sm font-extrabold text-gray-800">Oliver đã ghi nhận phiên học 🎉</div>
                </div>
              </div>
              <div className="text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0"
                style={{ background: '#f0fdf4', color: '#15803d' }}>
                Vừa xong
              </div>
            </div>

            {/* PHI Score Ring */}
            <div className="widget-card p-8 flex flex-col items-center">
              {/* Ring */}
              <div className={`relative w-56 h-56 mb-6 flex justify-center items-center ${healthScore >= 80 ? 'score-ring-good' : ''}`}>
                <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#F3F4F6" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="46" fill="none"
                    stroke={scoreColor}
                    strokeWidth="6"
                    strokeDasharray="289"
                    strokeDashoffset={scoreRingOffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="flex flex-col items-center justify-center">
                  <span className="widget-label mb-1">PHI SCORE</span>
                  <span className="text-6xl font-black text-gray-800">{healthScore}</span>
                  <span className="text-xs font-bold mt-1" style={{ color: scoreColor }}>
                    {healthScore >= 80 ? '✓ Tư thế tốt' : healthScore >= 60 ? '⚠ Cần điều chỉnh' : '✗ Sai tư thế'}
                  </span>
                </div>
              </div>

              {/* Camera toggle pill */}
              <div className="flex items-center gap-3 rounded-full px-3 py-2 mb-5"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <button
                  onClick={() => setShowCamera(!showCamera)}
                  className="w-9 h-9 rounded-full text-white flex items-center justify-center shadow-md transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #4ADE80, #22c55e)', boxShadow: '0 2px 8px rgba(74,222,128,0.4)' }}
                >
                  {showCamera ? <Camera size={15} fill="currentColor" /> : <CameraOff size={15} fill="currentColor" />}
                </button>
                <span className="widget-label tracking-wide pr-2">
                  {showCamera ? 'Ẩn camera' : 'Hiện camera'}
                </span>
              </div>

              {/* Streak dots */}
              <div className="flex items-center gap-1.5 mb-3">
                {['T2','T3','T4','T5','T6','T7','CN'].map((day, idx) => {
                  const isCompleted = idx < Math.min(userStats.streak, 7);
                  const isToday = idx === Math.min(userStats.streak, 7) - 1;
                  return (
                    <div key={idx}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold"
                      style={{
                        background: isToday
                          ? 'linear-gradient(135deg, #fb923c, #f97316)'
                          : isCompleted ? '#ffedd5' : '#F3F4F6',
                        color: isToday ? '#fff' : isCompleted ? '#ea580c' : '#9CA3AF',
                        boxShadow: isToday ? '0 2px 8px rgba(249,115,22,0.4)' : 'none',
                      }}>
                      {day[0]}
                    </div>
                  );
                })}
                <div className="text-xs font-black ml-1 px-2 py-1 rounded-lg"
                  style={{ background: '#fff7ed', color: '#ea580c' }}>x2</div>
              </div>

              <p className="text-center text-xs font-semibold text-gray-400">
                Tiếp tục chuỗi ngày.<br />Duy trì tư thế tốt mỗi ngày.
              </p>
            </div>

            {/* XP Progress */}
            <div className="widget-card p-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#eff6ff', color: '#3b82f6' }}>
                  <Shield size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="widget-label mb-1">Cấp {userStats.level + 1}</div>
                  <div className="text-sm font-extrabold text-gray-800 mb-2">
                    Còn {Math.max(0, userStats.level * 1000 - userStats.xp)} XP nữa
                  </div>
                  <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, (userStats.xp / (userStats.level * 1000)) * 100)}%`,
                        background: 'linear-gradient(90deg, #4ADE80, #22c55e)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ══ COLUMN 3 ════════════════════════════════════ */}
          <div className="flex flex-col gap-5">

            {/* Quick Tips */}
            <div className="widget-card p-6">
              <h3 className="widget-label flex items-center gap-2 mb-4">
                <span className="text-lg">💡</span> Mẹo Sức Khỏe
              </h3>
              <div className="flex -space-x-2.5 mb-4">
                {['bg-green-100', 'bg-blue-100', 'bg-purple-100'].map((c, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full border-2 border-white ${c}`} />
                ))}
                <div className="w-8 h-8 rounded-full border-2 border-white bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-500">+3</div>
              </div>
              <p className="text-sm font-bold text-gray-800 mb-1.5">3 mẹo dành cho bạn hôm nay</p>
              <p className="text-xs font-medium text-gray-400 mb-5 leading-relaxed">
                Ngồi thẳng lưng và giữ khoảng cách 60cm để bảo vệ mắt. Vươn vai sau mỗi 20 phút.
              </p>
              <button className="w-full py-3 font-bold text-white rounded-2xl shadow-md transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #4ADE80, #22c55e)', boxShadow: '0 4px 12px rgba(74,222,128,0.3)' }}>
                Xem chi tiết ➔
              </button>
            </div>

            {/* AI Camera Feed */}
            <div className="widget-card p-6 flex flex-col">
              <h3 className="widget-label flex items-center gap-2 mb-4">
                <Camera size={13} /> Camera AI Theo Dõi Tư Thế
              </h3>

              <div className="relative w-full rounded-2xl overflow-hidden mb-4 flex-shrink-0"
                style={{ height: '144px', background: '#111827', border: '3px solid #F9FAFB' }}>
                <video
                  ref={videoRef}
                  className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${!showCamera ? 'opacity-0' : 'opacity-100'}`}
                  autoPlay
                  playsInline
                  muted
                />
                {!showCamera && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400"
                    style={{ background: 'rgba(17,24,39,0.85)' }}>
                    <CameraOff size={22} className="mb-2 opacity-50" />
                    <span className="widget-label">Camera đã ẩn</span>
                  </div>
                )}
                {/* Live indicator */}
                {showCamera && (
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg"
                    style={{ background: 'rgba(0,0,0,0.6)' }}>
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white text-xs font-bold uppercase tracking-widest">Live</span>
                  </div>
                )}
              </div>

              <p className="text-xs font-medium text-gray-400 mb-4 leading-relaxed">
                AI theo dõi tư thế và khoảng cách mắt liên tục, thông báo cho bạn và phụ huynh.
              </p>

              <button
                onClick={() => setShowCamera(!showCamera)}
                className="w-full py-3.5 font-bold text-white rounded-2xl transition-all hover:opacity-90 mt-auto flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #4ADE80, #22c55e)', boxShadow: '0 4px 12px rgba(74,222,128,0.3)' }}
              >
                {showCamera ? <><CameraOff size={15} /> Ẩn Camera</> : <><Camera size={15} /> Hiện Camera</>}
              </button>
            </div>

            {/* Live Metrics Table */}
            <div className="widget-card p-6">
              <h3 className="widget-label mb-4">📊 Chỉ Số Tư Thế Thực Tế</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <th className="text-left pb-2.5 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Chỉ số</th>
                    <th className="text-right pb-2.5 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Mục tiêu</th>
                    <th className="text-right pb-2.5 font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Hiện tại</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #F9FAFB' }}>
                    <td className="py-3.5 font-bold text-gray-800">Gù lưng</td>
                    <td className="py-3.5 text-right font-bold text-gray-400">&lt; 15°</td>
                    <td className={`py-3.5 text-right font-black`}
                      style={{ color: metrics && metrics.slouchAngle > 15 ? '#FF5E5E' : '#4ADE80' }}>
                      {metrics ? Math.round(metrics.slouchAngle) : 0}°
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #F9FAFB' }}>
                    <td className="py-3.5 font-bold text-gray-800">Cúi cổ</td>
                    <td className="py-3.5 text-right font-bold text-gray-400">&lt; 20°</td>
                    <td className={`py-3.5 text-right font-black`}
                      style={{ color: metrics && metrics.neckAngle > 20 && !metrics.isWritingMode ? '#FF5E5E' : '#4ADE80' }}>
                      {metrics ? Math.round(metrics.neckAngle) : 0}°
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3.5 font-bold text-gray-800">Cách màn hình</td>
                    <td className="py-3.5 text-right font-bold text-gray-400">&gt; 50 cm</td>
                    <td className={`py-3.5 text-right font-black`}
                      style={{ color: metrics && metrics.eyeDistanceCm < 50 ? '#FF5E5E' : '#4ADE80' }}>
                      {metrics ? metrics.eyeDistanceCm : 60} cm
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentView;
