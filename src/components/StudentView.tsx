// Student Workspace Component - Premium Dashboard

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, Trophy, BookOpen, Volume2, VolumeX, CameraOff, Play, Info } from 'lucide-react';
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

  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [totalSessionMinutes, setTotalSessionMinutes] = useState<number>(0);
  const [badPostureSeconds, setBadPostureSeconds] = useState<number>(0);
  const [alertLevel, setAlertLevel] = useState<'none' | 'light' | 'strong'>('none');
  const [stretchBreakTriggered, setStretchBreakTriggered] = useState<boolean>(false);
  const [eyeExerciseTriggered, setEyeExerciseTriggered] = useState<boolean>(false);

  const [warningsCount, setWarningsCount] = useState<number>(0);
  const [blinkCount, setBlinkCount] = useState<number>(0);
  const [fidgetCount, setFidgetCount] = useState<number>(0);
  const [goodPostureCount, setGoodPostureCount] = useState<number>(0);
  const [totalTicks, setTotalTicks] = useState<number>(0);

  const [userStats, setUserStats] = useState(loadUserStats());
  const [badges, setBadges] = useState<Badge[]>(getBadgesStatus());

  const movementHistoryRef = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    const savedCalibration = loadCalibration();
    if (savedCalibration.baseEyeDistance !== 80 || localStorage.getItem('oliver_calibration_data')) {
      setCalibration(savedCalibration);
    }
  }, []);

  useEffect(() => {
    if (isModelReady && videoRef.current) {
      startCamera(videoRef.current);
    }
    return () => stopCamera();
  }, [isModelReady, startCamera, stopCamera]);

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
    alert('Buổi học đã hoàn thành! Dữ liệu đã được lưu trữ.');
  };

  if (!calibration) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-8">
        <div className="premium-card max-w-2xl w-full text-center p-12">
          <h2 className="text-3xl font-black text-gray-800 mb-2">Bắt đầu phiên học</h2>
          <p className="text-gray-500 mb-8">Hệ thống AI sẽ hiệu chỉnh để nhận diện tư thế chuẩn của bạn.</p>
          <div className="relative w-80 h-56 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl mb-6 mx-auto border border-gray-200">
            <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" autoPlay playsInline muted />
            {isLoading && (
              <div className="absolute inset-0 bg-gray-900/75 flex flex-col items-center justify-center text-white gap-3">
                <div className="w-8 h-8 border-3 border-green-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-semibold">Đang tải AI Engine...</span>
              </div>
            )}
          </div>
          <Calibration poseLandmarks={poseLandmarks} faceLandmarks={faceLandmarks} onCalibrationComplete={handleCalibrationComplete} isModelReady={isModelReady} />
        </div>
      </div>
    );
  }

  const scoreColor = healthScore >= 80 ? '#00d285' : healthScore >= 60 ? '#FFAA2C' : '#FF5E5E';
  const hh = Math.floor(totalSessionMinutes / 60).toString().padStart(2, '0');
  const mm = (totalSessionMinutes % 60).toString().padStart(2, '0');

  return (
    <div className={`min-h-full ${alertLevel === 'light' ? 'screen-alert-glow' : ''} ${alertLevel === 'strong' ? 'shake-warn' : ''}`}>
      
      {/* Overlays */}
      {eyeExerciseTriggered && <EyeExercise isBlinking={metrics?.isBlinking || false} onComplete={handleEyeExerciseComplete} />}
      {stretchBreakTriggered && (
        <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-3xl flex flex-col items-center justify-center text-white text-center p-8">
          <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 mb-6 animate-pulse">
            <BookOpen size={48} />
          </div>
          <h2 className="text-5xl font-black mb-4 tracking-tight">Đã Học 45 Phút!</h2>
          <p className="text-gray-300 text-xl mb-10 max-w-lg leading-relaxed">
            Cơ thể của bạn cần nghỉ ngơi. Hãy đứng dậy vươn vai, đi uống nước hoặc vận động nhẹ trong 1–2 phút nhé!
          </p>
          <button onClick={() => setStretchBreakTriggered(false)} className="btn-secondary text-lg px-10 py-4 shadow-[0_8px_32px_rgba(74,222,128,0.4)]">
            Tôi đã vận động xong
          </button>
        </div>
      )}

      {alertLevel === 'strong' && (
        <div className="fixed inset-0 z-40 bg-red-900/40 backdrop-blur-xl flex flex-col items-center justify-center text-white text-center p-4">
          <div className="premium-card bg-red-950/80 border border-red-500 p-10 max-w-lg shadow-[0_32px_64px_rgba(255,94,94,0.4)] animate-bounce">
            <AlertTriangle size={72} className="text-red-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(255,94,94,0.5)]" />
            <h2 className="text-4xl font-black mb-4">TƯ THẾ SAI NGHIÊM TRỌNG</h2>
            <p className="text-red-100 text-lg mb-8 leading-relaxed font-medium">
              Bạn đã ngồi sai tư thế liên tục hơn 2 phút! Hãy điều chỉnh lại khoảng cách và thẳng lưng ngay để bảo vệ cột sống và thị lực.
            </p>
            <button onClick={() => { setAlertLevel('none'); setBadPostureSeconds(0); }} className="btn-primary w-full bg-red-500 text-white border-none py-4 text-lg">
              Tôi Đã Sửa Tư Thế
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto">
        
        {/* Header Controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="relative w-full max-w-md">
             <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                </svg>
             </div>
             <input type="text" className="w-full pl-12 pr-4 py-3 rounded-full bg-white border border-gray-100 shadow-sm outline-none focus:ring-2 focus:ring-purple-300 transition-all font-medium text-gray-600" placeholder="Search features..." />
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => setIsAudioEnabled(!isAudioEnabled)} className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-gray-400 hover:text-purple-600 shadow-sm transition-all">
              {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button onClick={() => setCalibration(null)} className="pill-tag pill-primary py-3 px-5">
              <RefreshCw size={16} /> <span className="hidden sm:inline">Hiệu chỉnh lại</span>
            </button>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="hero-banner mb-8">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-4xl font-black mb-3">You're closer than you think!</h1>
              <p className="text-white/90 text-base font-medium max-w-lg leading-relaxed mb-6">
                Chỉ còn vài XP nữa là bạn đạt cấp độ tiếp theo. Hãy duy trì tư thế thẳng lưng và tập trung học tập để bứt phá bảng xếp hạng.
              </p>
              <button className="btn-primary" onClick={handleEndSession}>
                Lưu Phiên Học
              </button>
            </div>
            
            <div className="flex flex-col gap-3 shrink-0">
              <div className="bg-white/10 border border-white/20 backdrop-blur-md px-5 py-3 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 bg-yellow-400 text-yellow-900 rounded-full flex items-center justify-center font-black">
                  🔥
                </div>
                <div>
                  <div className="text-white font-bold text-lg">{userStats.streak} Days Streak</div>
                  <div className="text-white/70 text-xs font-semibold uppercase tracking-wider">Fast Learner</div>
                </div>
              </div>
              <div className="bg-white/10 border border-white/20 backdrop-blur-md px-5 py-3 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-400 text-blue-900 rounded-full flex items-center justify-center font-black">
                  ⭐
                </div>
                <div>
                  <div className="text-white font-bold text-lg">Level {userStats.level}</div>
                  <div className="text-white/70 text-xs font-semibold uppercase tracking-wider">Current Rank</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3-Column Premium Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: Progress & Pet */}
          <div className="flex flex-col gap-6">
            
            <div className="premium-card relative overflow-hidden group cursor-pointer border-b-4 border-b-purple-500">
              <div className="card-title"><Trophy size={18} className="text-purple-500" /> Cấp Độ & Kinh Nghiệm</div>
              <div className="flex items-center gap-5 mt-4">
                 <div className="text-5xl font-black text-gray-800">{userStats.level}</div>
                 <div className="flex-1">
                   <div className="flex justify-between text-sm font-bold mb-2">
                     <span className="text-gray-400">Tiến trình</span>
                     <span className="text-purple-600">{userStats.xp} / {userStats.level * 1000} XP</span>
                   </div>
                   <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                     <div className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (userStats.xp / (userStats.level * 1000)) * 100)}%` }} />
                   </div>
                 </div>
              </div>
            </div>

            <div className="premium-card text-center flex flex-col items-center border-b-4 border-b-blue-400">
               <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-4 shadow-inner border border-blue-100">
                 <div className="scale-150 origin-center -translate-y-2">
                    <OliverPet state={getPetState()} size={64} />
                 </div>
               </div>
               <h3 className="font-bold text-gray-800 text-lg mb-1">Thú Cưng Oliver</h3>
               <p className="text-gray-400 text-sm font-medium mb-4">Theo dõi bạn học tập thời gian thực</p>
               <div className="pill-tag bg-blue-100 text-blue-700">Trạng thái: {getPetState() === 'good' ? 'Vui vẻ' : getPetState() === 'slouch' ? 'Buồn bã' : 'Đang nhắc nhở'}</div>
            </div>

            <div className="premium-card">
              <div className="card-title">Bộ đếm thời gian</div>
              <div className="flex justify-center gap-3 font-mono text-4xl font-black text-gray-800 mt-6 mb-4">
                 <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 shadow-sm">{hh[0]}</div>
                 <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 shadow-sm">{hh[1]}</div>
                 <div className="text-gray-300 py-3">:</div>
                 <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 shadow-sm">{mm[0]}</div>
                 <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 shadow-sm">{mm[1]}</div>
              </div>
              <div className="flex justify-center gap-10 text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">
                <span>Giờ</span><span>Phút</span>
              </div>
              <button className="btn-secondary w-full" onClick={() => setStretchBreakTriggered(true)}>
                Tạm dừng 5 phút
              </button>
            </div>

          </div>

          {/* Column 2: Central Ring & Camera */}
          <div className="flex flex-col gap-6">
            
            <div className="premium-card flex flex-col items-center justify-center p-10 border-t-4 border-t-green-400">
              <div className="card-title w-full text-center justify-center mb-6">Daily Goal Left</div>
              
              <div className={`relative w-64 h-64 flex justify-center items-center mb-8 ${healthScore >= 80 ? 'score-ring-good' : ''}`}>
                <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#F3F4F6" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="44" fill="none"
                    stroke={scoreColor}
                    strokeWidth="6"
                    strokeDasharray="276"
                    strokeDashoffset={276 - (276 * healthScore) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="flex flex-col items-center justify-center">
                  <span className="text-gray-400 font-bold tracking-widest text-xs uppercase mb-1">PHI SCORE</span>
                  <span className="text-7xl font-black text-gray-800 tracking-tighter">{healthScore}</span>
                </div>
                
                {/* Play button overlay from image 1 */}
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-green-400 rounded-full text-white flex items-center justify-center shadow-[0_4px_12px_rgba(74,222,128,0.5)]">
                   <Play size={20} fill="currentColor" className="ml-1" />
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-full px-6 py-3 font-bold text-gray-400 text-sm shadow-inner border border-gray-100 w-full text-center">
                 Duy trì màu xanh để bảo vệ sức khỏe
              </div>
            </div>

            <div className="premium-card">
               <div className="flex justify-between items-center mb-4">
                 <div className="card-title m-0">Camera AI</div>
                 <button onClick={() => setShowCamera(!showCamera)} className={`pill-tag ${showCamera ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                   {showCamera ? 'Tắt' : 'Bật'}
                 </button>
               </div>
               <div className="relative w-full rounded-xl overflow-hidden bg-gray-900 border-2 border-gray-100 shadow-inner" style={{ height: '180px' }}>
                 <video
                    ref={videoRef}
                    className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${!showCamera ? 'opacity-0' : 'opacity-100'}`}
                    autoPlay playsInline muted
                 />
                 {!showCamera && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                      <CameraOff size={24} className="mb-2" />
                    </div>
                 )}
               </div>
            </div>

          </div>

          {/* Column 3: Leaderboard / Live Stats Table */}
          <div className="flex flex-col gap-6">
            
            <div className="premium-card border-l-4 border-l-yellow-400">
               <div className="flex justify-between items-center mb-6">
                  <div className="card-title m-0">Live Leaderboard</div>
                  <div className="pill-tag bg-yellow-100 text-yellow-700 text-[10px]">REAL TIME</div>
               </div>

               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="text-xs text-gray-400 uppercase bg-gray-50 rounded-lg font-bold">
                     <tr>
                       <th className="px-4 py-3 rounded-l-lg">Metric</th>
                       <th className="px-4 py-3 text-center">Goal</th>
                       <th className="px-4 py-3 rounded-r-lg text-right">Status</th>
                     </tr>
                   </thead>
                   <tbody>
                     <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                       <td className="px-4 py-4 font-bold text-gray-800 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-lg">🏃</div>
                         Khoảng cách
                       </td>
                       <td className="px-4 py-4 text-center font-bold text-gray-400">&gt; 50 cm</td>
                       <td className="px-4 py-4 text-right">
                         <span className={`pill-tag ${metrics && metrics.eyeDistanceCm < 50 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {metrics ? metrics.eyeDistanceCm : 60} cm
                         </span>
                       </td>
                     </tr>
                     <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                       <td className="px-4 py-4 font-bold text-gray-800 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-lg">🧍</div>
                         Lưng (Slouch)
                       </td>
                       <td className="px-4 py-4 text-center font-bold text-gray-400">&lt; 15°</td>
                       <td className="px-4 py-4 text-right">
                         <span className={`pill-tag ${metrics && metrics.slouchAngle > 15 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {metrics ? Math.round(metrics.slouchAngle) : 0}°
                         </span>
                       </td>
                     </tr>
                     <tr className="hover:bg-gray-50 transition-colors">
                       <td className="px-4 py-4 font-bold text-gray-800 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-lg">🧘</div>
                         Cúi cổ (Neck)
                       </td>
                       <td className="px-4 py-4 text-center font-bold text-gray-400">&lt; 20°</td>
                       <td className="px-4 py-4 text-right">
                         <span className={`pill-tag ${metrics && metrics.neckAngle > 20 && !metrics.isWritingMode ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {metrics ? Math.round(metrics.neckAngle) : 0}°
                         </span>
                       </td>
                     </tr>
                   </tbody>
                 </table>
               </div>
            </div>

            <div className="premium-card">
              <div className="card-title"><Info size={18} className="text-blue-500" /> Get Help</div>
              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl mb-5">
                <div className="flex -space-x-3">
                   {['bg-red-200','bg-green-200','bg-blue-200'].map((c,i)=><div key={i} className={`w-10 h-10 rounded-full border-2 border-white shadow-sm ${c}`} />)}
                </div>
                <div className="text-sm font-bold text-gray-800">
                  3 AI Tips for you
                  <div className="text-xs text-gray-400 font-medium">on completing your next step</div>
                </div>
              </div>
              <button className="btn-secondary w-full" style={{ background: '#00d285' }}>
                See Tips &rarr;
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default StudentView;
