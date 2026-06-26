// Student Workspace Component

import React, { useState, useEffect, useRef } from 'react';
import { Check, Shield, AlertTriangle, RefreshCw, Trophy, BookOpen, Volume2, VolumeX } from 'lucide-react';
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
    // If it is the default, we prompt user to calibrate
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

      // Lock screen after 45 minutes of continuous study
      const settings = loadSettings();
      if (mins > 0 && mins % settings.sessionBreakInterval === 0 && !stretchBreakTriggered) {
        setStretchBreakTriggered(true);
        playStretchSound();
      }

      // Trigger eye exercise after 20 minutes
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

    // Track shoulder coordinates to calculate fidget variance
    if (poseLandmarks && poseLandmarks.length > 12) {
      const leftShoulder = poseLandmarks[11];
      const rightShoulder = poseLandmarks[12];
      const shoulderMid = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
      };

      movementHistoryRef.current.push(shoulderMid);
      // Keep only last 100 frames (~10 seconds)
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

    // Track stats over session
    setTotalTicks(t => t + 1);
    if (calculatedScore >= 80) {
      setGoodPostureCount(g => g + 1);
    }

    // Blink detection
    if (calculatedMetrics.isBlinking) {
      setBlinkCount(b => b + 1);
    }

    // Fidget threshold check (flag every 5 minutes if variance is high)
    if (calculatedMetrics.fidgetFactor > 40 && totalTicks > 0 && totalTicks % 300 === 0) {
      setFidgetCount(f => f + 1);
      broadcastFatigueAlert("Bé bắt đầu nhấp nhổm nhiều, có dấu hiệu mất tập trung hoặc mỏi cơ.");
    }

    // Determine posture warning state
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

    // Contextual alert triggering:
    // Bad posture for >30 seconds -> Light alert (Glow red screen border)
    if (badPostureSeconds >= 30 && badPostureSeconds < 120) {
      setAlertLevel('light');
    }
    // Bad posture for >2 minutes (120 seconds) -> Strong alert (Beep sound, screen popup warning)
    else if (badPostureSeconds >= 120) {
      if (alertLevel !== 'strong') {
        setAlertLevel('strong');
        setWarningsCount(w => w + 1);
        if (isAudioEnabled && settings.soundAlertEnabled) {
          playBeepSound();
        }
      }
    }

    // Broadcast data to parent view in real time (privacy-first: strictly numerical state metrics)
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

  // Audio synths for warning triggers
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

  // Determine current pet animation state
  const getPetState = (): PetState => {
    if (eyeExerciseTriggered) return 'tired';
    if (metrics?.isWritingMode) return 'writing';
    if (metrics && metrics.eyeDistanceCm < 50) return 'close';
    if (metrics && (metrics.slouchAngle > 15 || metrics.shoulderTilt > 7)) return 'slouch';
    if (healthScore >= 80) return 'good';
    return 'good';
  };

  // Callbacks
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
    
    // Save session record
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

    // Gamification check:
    // Badge 1: Resilient Warrior (straight > 80% and duration > 5 mins)
    if (goodPosturePercentage > 80 && totalSessionMinutes >= 5) {
      addXP(500);
      const isNew = badges.find(b => b.id === 'warrior')?.unlocked === false;
      if (isNew) {
        localStorage.setItem('oliver_unlocked_badge_warrior', 'true');
        addXP(1000); // bonus
      }
    }

    // Reset session
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

  if (!calibration) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 min-h-screen">
        {/* Render Live Camera Preview behind the calibration card for feedback */}
        <div className="relative w-80 h-60 bg-gray-900 rounded-2xl overflow-hidden shadow-inner mb-6">
          <video
            ref={videoRef}
            className="w-full h-full object-cover scale-x-[-1]"
            autoPlay
            playsInline
            muted
          />
          {isLoading && (
            <div className="absolute inset-0 bg-gray-900 bg-opacity-70 flex items-center justify-center text-white text-sm">
              Đang tải AI Engine...
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

  return (
    <div className={`flex-1 p-6 lg:p-10 bg-[#f8f9fa] overflow-y-auto ${alertLevel === 'light' ? 'screen-alert-glow' : ''} ${alertLevel === 'strong' ? 'shake-warn' : ''}`}>
      
      {/* 20-20-20 Rule Exercise Overlay */}
      {eyeExerciseTriggered && (
        <EyeExercise
          isBlinking={metrics?.isBlinking || false}
          onComplete={handleEyeExerciseComplete}
        />
      )}

      {/* Screen Lock for Stretch Break */}
      {stretchBreakTriggered && (
        <div className="fixed inset-0 z-50 bg-gray-950 bg-opacity-90 backdrop-blur-2xl flex flex-col items-center justify-center text-white text-center p-8">
          <div className="w-24 h-24 bg-green-500 bg-opacity-20 rounded-full flex items-center justify-center text-green-400 mb-6 animate-pulse">
            <BookOpen size={48} />
          </div>
          <h2 className="text-4xl font-extrabold mb-4">Đã Học Liên Tục 45 Phút!</h2>
          <p className="text-gray-300 text-lg mb-8 max-w-md">
            Cơ thể của bạn cần nghỉ ngơi. Hãy đứng dậy vươn vai, đi uống nước hoặc vận động nhẹ trong 1-2 phút nhé!
          </p>
          <button
            onClick={() => setStretchBreakTriggered(false)}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-2xl shadow-md transition-all"
          >
            Tôi đã vận động xong
          </button>
        </div>
      )}

      {/* Strong Warn overlay takeover */}
      {alertLevel === 'strong' && (
        <div className="fixed inset-0 z-40 bg-red-900 bg-opacity-40 backdrop-blur-md flex flex-col items-center justify-center text-white text-center p-4">
          <div className="glass-card border border-red-500 bg-red-950 bg-opacity-40 p-8 rounded-3xl max-w-md shadow-2xl animate-bounce">
            <AlertTriangle size={64} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-3xl font-black mb-2">TƯ THẾ SAI NGHIÊM TRỌNG</h2>
            <p className="text-red-100 text-base mb-6">
              Bạn đã ngồi sai tư thế liên tục hơn 2 phút! Hãy điều chỉnh lại khoảng cách và thẳng lưng ngay để bảo vệ cột sống và thị lực.
            </p>
            <button
              onClick={() => {
                setAlertLevel('none');
                setBadPostureSeconds(0);
              }}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition-all"
            >
              Tôi Đã Sửa Tư Thế
            </button>
          </div>
        </div>
      )}

      {/* Dashboard Container */}
      <div className="max-w-[1400px] mx-auto">
        
        {/* Header Options */}
        <div className="flex justify-end items-center mb-6 gap-3">
          <button 
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            className="p-3 bg-white text-gray-600 hover:text-green-600 transition-all rounded-xl shadow-sm border border-gray-100"
            title={isAudioEnabled ? 'Tắt âm thanh cảnh báo' : 'Bật âm thanh cảnh báo'}
          >
            {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button
            onClick={() => setCalibration(null)}
            className="flex items-center gap-2 px-4 py-3 bg-white text-sm font-semibold text-gray-600 hover:text-green-600 transition-all rounded-xl shadow-sm border border-gray-100"
          >
            <RefreshCw size={16} /> Hiệu chỉnh lại
          </button>
        </div>

        {/* Masonry-like Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
          
          {/* Column 1 */}
          <div className="flex flex-col gap-6">
            
            {/* Widget 1: 7 Days Snapshot */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm shadow-gray-200/50 border border-gray-50 relative">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                  📅 Your 7 Days Snapshot
               </h3>
               
               <div className="space-y-5">
                 <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-100 to-yellow-50 text-yellow-500 font-black flex items-center justify-center text-xl shadow-sm border border-yellow-100">{Math.round(userStats.totalStudyTime / 60)}</div>
                    <div className="flex-1">
                      <div className="text-base font-extrabold text-gray-800">Hours</div>
                      <div className="text-xs font-semibold text-gray-400">Logged</div>
                    </div>
                    <div className="text-sm font-bold text-[#4ADE80]">↗ 8%</div>
                 </div>

                 <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-100 to-yellow-50 text-yellow-500 font-black flex items-center justify-center text-xl shadow-sm border border-yellow-100">{userStats.streak}</div>
                    <div className="flex-1">
                      <div className="text-base font-extrabold text-gray-800">Steps</div>
                      <div className="text-xs font-semibold text-gray-400">Complete (Days)</div>
                    </div>
                    <div className="text-sm font-bold text-[#FF5E5E]">↘ -5%</div>
                 </div>

                 <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-100 to-yellow-50 text-yellow-500 font-black flex items-center justify-center text-xl shadow-sm border border-yellow-100">{userStats.level}</div>
                    <div className="flex-1">
                      <div className="text-base font-extrabold text-gray-800">Spot</div>
                      <div className="text-xs font-semibold text-gray-400">in the ranking (Level)</div>
                    </div>
                    <div className="text-sm font-bold text-[#4ADE80]">↗ 10%</div>
                 </div>
               </div>
            </div>

            {/* Widget 2: Current Rank / Session Timer */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm shadow-gray-200/50 border border-gray-50 relative">
               <h3 className="text-base font-extrabold text-gray-800 mb-6 flex items-center justify-between">
                 Current Rank
                 <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 text-white flex items-center justify-center font-bold text-sm shadow-sm border-2 border-yellow-200">6</span>
               </h3>

               <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-6">
                 <div className="text-center">
                   <div className="text-2xl font-black text-gray-800">{userStats.streak}</div>
                   <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Days</div>
                 </div>
                 <div className="text-center">
                   <div className="text-2xl font-black text-gray-800">{Math.round(userStats.totalStudyTime/60)}</div>
                   <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Hours</div>
                 </div>
                 <div className="text-center">
                   <div className="text-2xl font-black text-gray-800">{userStats.badges.length}</div>
                   <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Badges</div>
                 </div>
               </div>

               <div className="flex flex-col items-center justify-center mb-6">
                 <div className="text-xs font-bold text-gray-400 mb-3">Time Elapsed on Your Session</div>
                 <div className="flex gap-2 text-2xl font-black text-gray-800 font-mono">
                    <div className="bg-gray-100/80 w-12 h-14 rounded-xl shadow-inner flex items-center justify-center border border-gray-200/50">
                      {Math.floor(totalSessionMinutes / 60).toString().padStart(2, '0')[0]}
                    </div>
                    <div className="bg-gray-100/80 w-12 h-14 rounded-xl shadow-inner flex items-center justify-center border border-gray-200/50">
                      {Math.floor(totalSessionMinutes / 60).toString().padStart(2, '0')[1]}
                    </div>
                    <span className="pt-2 text-gray-300">:</span>
                    <div className="bg-gray-100/80 w-12 h-14 rounded-xl shadow-inner flex items-center justify-center border border-gray-200/50">
                      {(totalSessionMinutes % 60).toString().padStart(2, '0')[0]}
                    </div>
                    <div className="bg-gray-100/80 w-12 h-14 rounded-xl shadow-inner flex items-center justify-center border border-gray-200/50">
                      {(totalSessionMinutes % 60).toString().padStart(2, '0')[1]}
                    </div>
                 </div>
                 <div className="flex gap-16 mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                   <span>Hrs</span>
                   <span>Min</span>
                 </div>
               </div>

               <button 
                 onClick={handleEndSession}
                 className="w-full py-4 bg-[#4ADE80] hover:bg-[#3bce6f] text-white font-bold rounded-2xl shadow-md transition-all flex justify-center items-center gap-2"
               >
                 <RefreshCw size={18} /> End Session & Sync
               </button>
            </div>

            {/* Badges Checklist */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm shadow-gray-200/50 border border-gray-50 relative">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                 <Trophy size={16} /> Earned Badges
               </h3>
               
               <div className="space-y-4">
                 {badges.map((badge) => (
                   <div key={badge.id} className="flex justify-between items-center border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                     <div className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center ${badge.unlocked ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                         {badge.unlocked ? <Check size={14} /> : <Shield size={14} />}
                       </div>
                       <div>
                         <div className="text-sm font-bold text-gray-800">{badge.name}</div>
                         <div className="text-[10px] text-gray-400">{badge.description}</div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-6">
            
            {/* Top Toast */}
            <div className="bg-white rounded-[32px] p-4 shadow-sm shadow-gray-200/50 border border-gray-50 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="w-12 h-12 relative overflow-hidden bg-purple-50 flex items-center justify-center rounded-full border border-purple-100">
                    <div className="scale-75 origin-center -translate-y-2">
                       <OliverPet state={getPetState()} size={60} />
                    </div>
                 </div>
                 <div>
                   <div className="text-xs font-bold text-gray-400">New Achievement</div>
                   <div className="text-sm font-extrabold text-gray-800">
                     Oliver Logged a session 🎉
                   </div>
                 </div>
               </div>
               <div className="text-xs font-bold text-[#4ADE80] bg-green-50 px-2 py-1 rounded-lg">Just Now</div>
            </div>

            {/* Central Progress Circle Widget (Health Score) */}
            <div className="bg-white rounded-[32px] p-8 shadow-sm shadow-gray-200/50 border border-gray-50 flex flex-col items-center justify-center">
               <div className="relative w-56 h-56 mb-8 flex justify-center items-center">
                 {/* Progress Ring */}
                 <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                   <circle cx="50" cy="50" r="46" fill="none" stroke="#F3F4F6" strokeWidth="6" />
                   <circle 
                     cx="50" cy="50" r="46" fill="none" 
                     stroke={healthScore >= 80 ? '#4ADE80' : healthScore >= 60 ? '#FBBF24' : '#FF5E5E'} 
                     strokeWidth="6" 
                     strokeDasharray="289" 
                     strokeDashoffset={289 - (289 * healthScore) / 100} 
                     strokeLinecap="round" 
                     className="transition-all duration-1000 ease-out"
                   />
                 </svg>
                 
                 {/* Center Content */}
                 <div className="flex flex-col items-center justify-center mt-2">
                   <span className="text-xs font-bold text-gray-400 mb-1 tracking-widest">PHI SCORE</span>
                   <span className="text-6xl font-black text-gray-800">{healthScore}</span>
                 </div>
               </div>

               {/* Play/Pause Button Area mapped to Camera */}
               <div className="flex items-center bg-gray-50/80 rounded-full pr-6 pl-2 py-2 gap-4 border border-gray-100 mb-6">
                 <button 
                   onClick={() => setShowCamera(!showCamera)} 
                   className="w-10 h-10 rounded-full bg-[#4ADE80] text-white flex items-center justify-center shadow-md shadow-green-200 hover:bg-[#3bce6f] hover:scale-105 transition-all"
                 >
                   {showCamera ? <VolumeX size={16} fill="currentColor" /> : <Volume2 size={16} fill="currentColor" />}
                 </button>
                 <span className="text-xs font-bold text-gray-400 tracking-wide">Slide to Toggle Camera</span>
               </div>

               <div className="flex items-center gap-2 mb-3">
                 {/* Streak days bubbles */}
                 {['M','T','W','T','F','S','S'].map((day, idx) => {
                    const isCompleted = idx < Math.min(userStats.streak, 7);
                    const isToday = idx === Math.min(userStats.streak, 7) - 1;
                    return (
                      <div key={idx} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold ${isToday ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-md shadow-orange-200' : isCompleted ? 'bg-orange-100 text-orange-500' : 'bg-gray-100 text-gray-400'}`}>
                        {day}
                      </div>
                    )
                 })}
                 <div className="text-xs font-black text-orange-400 ml-1 px-2 py-1 bg-orange-50 rounded-lg">x2</div>
               </div>
               <div className="text-center text-[11px] font-semibold text-gray-400 leading-relaxed">
                 Continue building your Streak.<br/>Maintain good posture daily.
               </div>
            </div>

            {/* Next Badge Progress */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm shadow-gray-200/50 border border-gray-50">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-400 flex items-center justify-center">
                   <Shield size={20} />
                 </div>
                 <div className="flex-1">
                    <div className="text-xs font-bold text-gray-400 mb-1">Level {userStats.level + 1}</div>
                    <div className="text-sm font-extrabold text-gray-800 mb-2">You're {userStats.level * 1000 - userStats.xp} XP away</div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#4ADE80]" style={{width: `${(userStats.xp / (userStats.level * 1000)) * 100}%`}}></div>
                    </div>
                 </div>
               </div>
            </div>
          </div>

          {/* Column 3 */}
          <div className="flex flex-col gap-6">
            
            {/* Quick Tips */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm shadow-gray-200/50 border border-gray-50">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <span className="text-xl">💡</span> Quick Tips
               </h3>
               
               <div className="flex -space-x-3 mb-4">
                 <div className="w-8 h-8 rounded-full border-2 border-white bg-green-100 z-30"></div>
                 <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-100 z-20"></div>
                 <div className="w-8 h-8 rounded-full border-2 border-white bg-purple-100 z-10"></div>
               </div>
               
               <p className="text-sm font-bold text-gray-800 mb-2">
                 3 tips available for you
               </p>
               <p className="text-xs font-medium text-gray-400 mb-6">
                 Ngồi thẳng lưng và giữ khoảng cách 60cm để bảo vệ mắt. Vươn vai sau mỗi 20 phút.
               </p>
               <button className="w-full py-3 bg-[#4ADE80] hover:bg-[#3bce6f] text-white font-bold rounded-2xl shadow-md transition-all">
                 See Tips ➔
               </button>
            </div>

            {/* Inspire Others (Camera) */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm shadow-gray-200/50 border border-gray-50 flex flex-col h-full">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                 ⭐ Inspire Others (AI Camera)
               </h3>
               
               <div className="w-full h-36 bg-gray-900 rounded-[20px] overflow-hidden relative shadow-inner mb-6 flex-shrink-0 border-4 border-gray-50">
                  <video
                    ref={videoRef}
                    className={`w-full h-full object-cover scale-x-[-1] ${!showCamera ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                    autoPlay
                    playsInline
                    muted
                  />
                  {!showCamera && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-800/80">
                      <VolumeX size={24} className="mb-2 opacity-50" />
                      <span className="text-xs font-bold uppercase tracking-widest">Camera Hidden</span>
                    </div>
                  )}
               </div>

               <p className="text-xs font-medium text-gray-400 mb-6 leading-relaxed">
                 Take action and AI will monitor your posture to notify you and your parents.
               </p>
               
               <button 
                 onClick={() => setShowCamera(!showCamera)}
                 className="w-full py-4 mt-auto bg-[#4ADE80] hover:bg-[#3bce6f] text-white font-bold rounded-2xl shadow-md transition-all"
               >
                 {showCamera ? 'Hide Camera' : 'Take Action (Show)'}
               </button>
            </div>

            {/* Live Metrics (replaces Social Impact) */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm shadow-gray-200/50 border border-gray-50">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">
                 Live Metrics
               </h3>
               
               <table className="w-full text-xs">
                 <thead>
                   <tr className="text-right text-[10px] text-gray-400 uppercase tracking-widest border-b border-gray-50">
                     <th className="text-left pb-3 font-semibold">Indicator</th>
                     <th className="pb-3 font-semibold">Goal</th>
                     <th className="pb-3 font-semibold">Current</th>
                   </tr>
                 </thead>
                 <tbody>
                   {/* Slouch */}
                   <tr className="border-b border-gray-50">
                     <td className="py-4 font-bold text-gray-800">Slouch Angle</td>
                     <td className="py-4 text-right font-bold text-gray-400">&lt; 15°</td>
                     <td className={`py-4 text-right font-black ${metrics && metrics.slouchAngle > 15 ? 'text-[#FF5E5E]' : 'text-[#4ADE80]'}`}>
                        {metrics ? Math.round(metrics.slouchAngle) : 0}°
                     </td>
                   </tr>
                   {/* Neck */}
                   <tr className="border-b border-gray-50">
                     <td className="py-4 font-bold text-gray-800">Neck Tilt</td>
                     <td className="py-4 text-right font-bold text-gray-400">&lt; 20°</td>
                     <td className={`py-4 text-right font-black ${metrics && metrics.neckAngle > 20 && !metrics.isWritingMode ? 'text-[#FF5E5E]' : 'text-[#4ADE80]'}`}>
                        {metrics ? Math.round(metrics.neckAngle) : 0}°
                     </td>
                   </tr>
                   {/* Distance */}
                   <tr>
                     <td className="py-4 font-bold text-gray-800">Eye Distance</td>
                     <td className="py-4 text-right font-bold text-gray-400">&gt; 50 cm</td>
                     <td className={`py-4 text-right font-black ${metrics && metrics.eyeDistanceCm < 50 ? 'text-[#FF5E5E]' : 'text-[#4ADE80]'}`}>
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
