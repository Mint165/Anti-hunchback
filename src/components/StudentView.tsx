// Student Workspace Component - Premium Dashboard

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw, Trophy, BookOpen, Volume2, VolumeX, CameraOff, Play, Info } from 'lucide-react';
import type { CalibrationData } from '../services/postureAI';
import { loadUserStats, saveSessionRecord, addXP, getBadgesStatus } from '../services/db';
import type { Badge } from '../services/db';
import { broadcastStudentStatus, broadcastFatigueAlert } from '../services/parentSync';
import { usePostureContext } from '../contexts/PostureContext';
import OliverPet from './OliverPet';
import type { PetState } from './OliverPet';
import Calibration from './Calibration';

export const StudentView: React.FC = () => {
  const {
    metrics, healthScore, alertLevel, hasStarted, startSession, resetBreak,
    isModelReady, isLoading, calibration, setCalibration, 
    poseLandmarks, faceLandmarks,
    sessionFatigueFlags, sessionAngleAccumulator,
  } = usePostureContext();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showCamera, setShowCamera] = useState<boolean>(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);

  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [totalSessionMinutes, setTotalSessionMinutes] = useState<number>(0);

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
    if (globalVideo && videoRef.current && videoRef.current.srcObject !== globalVideo.srcObject) {
       videoRef.current.srcObject = globalVideo.srcObject;
    }
  }, [showCamera, hasStarted]); // Run when camera is toggled or session starts

  useEffect(() => {
    if (!hasStarted) return;
    const interval = setInterval(() => {
      const mins = Math.floor((Date.now() - sessionStartTime) / 60000);
      setTotalSessionMinutes(mins);
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

    const overallStatus = healthScore >= 85 ? 'good' : healthScore >= 70 ? 'warning' : 'danger';
    broadcastStudentStatus(overallStatus, {
      eyeDistanceCm: metrics.eyeDistanceCm,
      neckAngle: metrics.neckAngle,
      shoulderTilt: metrics.shoulderTilt,
      slouchAngle: metrics.slouchAngle,
      healthScore: healthScore,
      isWritingMode: metrics.isWritingMode,
    });

  }, [metrics, healthScore, isModelReady, calibration]);

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
      addXP(500);
      const isNew = badges.find(b => b.id === 'warrior')?.unlocked === false;
      if (isNew) {
        localStorage.setItem('oliver_unlocked_badge_warrior', 'true');
        addXP(1000);
      }
    }

    setSessionStartTime(Date.now());
    setTotalSessionMinutes(0);
    warningsCountRef.current = 0;
    blinkCountRef.current = 0;
    fidgetCountRef.current = 0;
    goodPostureCountRef.current = 0;
    totalTicksRef.current = 0;
    setUserStats(loadUserStats());
    setBadges(getBadgesStatus());
    alert('Buổi học đã hoàn thành! Dữ liệu đã được lưu trữ.');
  };

  if (!calibration) {
    return (
      <div className="calibration-container">
        <div className="premium-card calibration-card">
          <h2 className="calibration-title">Bắt đầu phiên học</h2>
          <p className="calibration-desc">Hệ thống AI sẽ hiệu chỉnh để nhận diện tư thế chuẩn của bạn.</p>
          <div className="calibration-video-wrapper">
            <video ref={videoRef} className="calibration-video" autoPlay playsInline muted />
            {isLoading && (
              <div className="calibration-loading">
                <div className="spinner" />
                <span>Đang tải AI Engine...</span>
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
    <div className={`min-h-full ${alertLevel === 'MILD_WARNING' ? 'screen-alert-glow' : ''} ${alertLevel === 'STRONG_WARNING' ? 'shake-warn' : ''}`}>
      
      {/* Overlays */}
      {!hasStarted && (
        <div className="fixed inset-0 z-[60] bg-gray-900/95 backdrop-blur-3xl flex flex-col items-center justify-center text-white text-center p-8">
          <h2 className="text-5xl font-black mb-4 tracking-tight">Sẵn Sàng Học Tập!</h2>
          <p className="text-gray-300 text-xl mb-10 max-w-lg leading-relaxed">
            Hệ thống AI sẽ theo dõi tư thế của bạn để bảo vệ cột sống và mắt. Vui lòng bấm Bắt Đầu để cấp quyền âm thanh cảnh báo.
          </p>
          <button onClick={() => { startSession(); setSessionStartTime(Date.now()); }} className="btn-primary text-lg px-10 py-4 shadow-[0_8px_32px_rgba(74,222,128,0.4)]">
            Bắt Đầu Học
          </button>
        </div>
      )}

      {alertLevel === 'BREAK_TIME' && (
        <div className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-3xl flex flex-col items-center justify-center text-white text-center p-8">
          <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 mb-6 animate-pulse">
            <BookOpen size={48} />
          </div>
          <h2 className="text-5xl font-black mb-4 tracking-tight">Đã Học 45 Phút!</h2>
          <p className="text-gray-300 text-xl mb-10 max-w-lg leading-relaxed">
            Cơ thể của bạn cần nghỉ ngơi. Hãy đứng dậy vươn vai, đi uống nước hoặc vận động nhẹ trong 1–2 phút nhé!
          </p>
          <button onClick={() => resetBreak()} className="btn-secondary text-lg px-10 py-4 shadow-[0_8px_32px_rgba(74,222,128,0.4)]">
            Tôi đã vận động xong
          </button>
        </div>
      )}

      {alertLevel === 'STRONG_WARNING' && (
        <div className="fixed inset-0 z-40 bg-red-900/40 backdrop-blur-xl flex flex-col items-center justify-center text-white text-center p-4">
          <div className="premium-card bg-red-950/80 border border-red-500 p-10 max-w-lg shadow-[0_32px_64px_rgba(255,94,94,0.4)] animate-bounce">
            <AlertTriangle size={72} className="text-red-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(255,94,94,0.5)]" />
            <h2 className="text-4xl font-black mb-4">TƯ THẾ SAI NGHIÊM TRỌNG</h2>
            <p className="text-red-100 text-lg mb-8 leading-relaxed font-medium">
              Bạn đã ngồi sai tư thế liên tục hơn 2 phút! Hãy điều chỉnh lại khoảng cách và thẳng lưng ngay để bảo vệ cột sống và thị lực.
            </p>
            <button onClick={() => resetBreak()} className="btn-primary w-full bg-red-500 text-white border-none py-4 text-lg">
              Tôi Đã Sửa Tư Thế
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
            <button onClick={() => setIsAudioEnabled(!isAudioEnabled)} className="sv-audio-btn">
              {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button onClick={() => setCalibration(null)} className="pill-tag pill-primary">
              <RefreshCw size={16} /> <span>Hiệu chỉnh lại</span>
            </button>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="hero-banner">
          <div className="hero-content">
            <div className="hero-text">
              <h1>You're closer than you think!</h1>
              <p>Chỉ còn vài XP nữa là bạn đạt cấp độ tiếp theo. Hãy duy trì tư thế thẳng lưng và tập trung học tập để bứt phá bảng xếp hạng.</p>
              <button className="btn-primary" onClick={handleEndSession}>Lưu Phiên Học</button>
            </div>
            
            <div className="hero-stats">
              <div className="hero-stat-card">
                <div className="hero-stat-icon" style={{ background: '#facc15', color: '#713f12' }}>🔥</div>
                <div>
                  <div className="hero-stat-val">{userStats.streak} Days Streak</div>
                  <div className="hero-stat-lbl">Fast Learner</div>
                </div>
              </div>
              <div className="hero-stat-card">
                <div className="hero-stat-icon" style={{ background: '#60a5fa', color: '#1e3a8a' }}>⭐</div>
                <div>
                  <div className="hero-stat-val">Level {userStats.level}</div>
                  <div className="hero-stat-lbl">Current Rank</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3-Column Premium Grid */}
        <div className="sv-grid">
          
          {/* Column 1: Progress & Pet */}
          <div className="sv-col">
            
            <div className="premium-card xp-card">
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

            <div className="premium-card pet-card">
               <div className="pet-circle">
                 <div className="pet-model">
                    <OliverPet state={getPetState()} size={64} />
                 </div>
               </div>
               <h3>Thú Cưng Oliver</h3>
               <p>Theo dõi bạn học tập thời gian thực</p>
               <div className="pill-tag pill-secondary">Trạng thái: {getPetState() === 'good' ? 'Vui vẻ' : getPetState() === 'slouch' ? 'Buồn bã' : 'Đang nhắc nhở'}</div>
            </div>

            <div className="premium-card timer-card">
              <div className="card-title">Bộ đếm thời gian</div>
              <div className="timer-display">
                 <div className="timer-digit">{hh[0]}</div>
                 <div className="timer-digit">{hh[1]}</div>
                 <div className="timer-colon">:</div>
                 <div className="timer-digit">{mm[0]}</div>
                 <div className="timer-digit">{mm[1]}</div>
              </div>
              <div className="timer-labels">
                <span>Giờ</span><span>Phút</span>
              </div>
              <button className="btn-secondary w-full" onClick={() => resetBreak()}>
                Bắt đầu phiên học mới
              </button>
            </div>

          </div>

          {/* Column 2: Central Ring & Camera */}
          <div className="sv-col">
            
            <div className="premium-card ring-card">
              <div className="card-title">Daily Goal Left</div>
              
              <div className={`score-ring-wrapper ${healthScore >= 80 ? 'score-ring-good' : ''}`}>
                <svg className="score-ring-svg" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#F3F4F6" strokeWidth="6" />
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
                
                <div className="score-play-btn">
                   <Play size={20} fill="currentColor" />
                </div>
              </div>
              
              <div className="score-footer">
                 Duy trì màu xanh để bảo vệ sức khỏe
              </div>
            </div>

            <div className="premium-card camera-card">
               <div className="camera-header">
                 <div className="card-title">Camera AI</div>
                 <button onClick={() => setShowCamera(!showCamera)} className={`pill-tag ${showCamera ? 'camera-off-pill' : 'camera-on-pill'}`}>
                   {showCamera ? 'Tắt' : 'Bật'}
                 </button>
               </div>
               <div className="camera-wrapper">
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
               </div>
            </div>

          </div>

          {/* Column 3: Leaderboard / Live Stats Table */}
          <div className="sv-col">
            
            <div className="premium-card leaderboard-card">
               <div className="leaderboard-header">
                  <div className="card-title m-0">Live Leaderboard</div>
                  <div className="pill-tag pill-realtime">REAL TIME</div>
               </div>

               <div className="table-wrapper">
                 <table className="sv-table">
                   <thead>
                     <tr>
                       <th className="th-left">Metric</th>
                       <th className="th-center">Goal</th>
                       <th className="th-right">Status</th>
                     </tr>
                   </thead>
                   <tbody>
                     <tr>
                       <td className="td-metric">
                         <div className="metric-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>🏃</div>
                         Khoảng cách
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
                         <div className="metric-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}>🧍</div>
                         Lưng (Slouch)
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
                         <div className="metric-icon" style={{ background: '#ffedd5', color: '#ea580c' }}>🧘</div>
                         Cúi cổ (Neck)
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
            </div>

            <div className="premium-card tips-card">
              <div className="card-title"><Info size={18} className="text-blue-500" /> Get Help</div>
              <div className="tips-banner">
                <div className="tips-avatars">
                   {['bg-red-200','bg-green-200','bg-blue-200'].map((c,i)=><div key={i} className={`tip-avatar ${c}`} />)}
                </div>
                <div className="tips-text">
                  3 AI Tips for you
                  <div className="tips-subtext">on completing your next step</div>
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
