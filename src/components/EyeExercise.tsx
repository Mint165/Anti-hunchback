// Eye Exercise (20-20-20 Rule) Screen Dimming Component

import React, { useState, useEffect, useRef } from 'react';
import { Eye, Award } from 'lucide-react';
import { addXP } from '../services/db';

interface EyeExerciseProps {
  isBlinking: boolean;
  onComplete: (xpGained: number) => void;
}

export const EyeExercise: React.FC<EyeExerciseProps> = ({ isBlinking, onComplete }) => {
  const [blinksCount, setBlinksCount] = useState<number>(0);
  const [targetPos, setTargetPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [exerciseStatus, setExerciseStatus] = useState<'active' | 'success'>('active');
  const wasBlinkingRef = useRef<boolean>(false);

  // Target movement path logic (smooth circle path)
  useEffect(() => {
    if (exerciseStatus !== 'active') return;

    let angle = 0;
    const interval = setInterval(() => {
      angle += 0.03;
      // Calculate coordinates in viewport percentage (keeping safe margins)
      const x = 50 + 35 * Math.sin(angle);
      const y = 50 + 25 * Math.cos(angle * 1.5);
      setTargetPos({ x, y });
    }, 30);

    return () => clearInterval(interval);
  }, [exerciseStatus]);

  // Blink counter logic
  // Listens to isBlinking prop (which turns true when user shuts eyes and false when they open them)
  useEffect(() => {
    if (exerciseStatus !== 'active') return;

    if (isBlinking && !wasBlinkingRef.current) {
      // User just closed their eyes
      wasBlinkingRef.current = true;
    } else if (!isBlinking && wasBlinkingRef.current) {
      // User just opened their eyes (completed blink)
      wasBlinkingRef.current = false;
      const nextCount = blinksCount + 1;
      setBlinksCount(nextCount);

      // Play a soft sound using Web Audio API
      playChime();

      if (nextCount >= 4) {
        // Exercise completed!
        setExerciseStatus('success');
        playSuccessFanfare();
        // Grant XP
        addXP(200);
        setTimeout(() => {
          onComplete(200);
        }, 2000);
      }
    }
  }, [isBlinking, blinksCount, exerciseStatus, onComplete]);

  // Web Audio API synthesizers for interactive feedback without assets
  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
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
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 bg-opacity-80 backdrop-blur-xl transition-all duration-500">
      
      {/* Exercise Active Screen Overlay */}
      {exerciseStatus === 'active' ? (
        <div className="text-center p-8 max-w-xl glass-card border border-white border-opacity-10 text-white relative bg-opacity-10 shadow-2xl">
          <div className="w-20 h-20 mx-auto rounded-full bg-purple-500 bg-opacity-20 flex items-center justify-center text-purple-300 mb-6 animate-pulse">
            <Eye size={40} />
          </div>
          
          <h2 className="text-3xl font-extrabold mb-4 tracking-tight">Đến Giờ Thư Giãn Mắt! (Quy tắc 20-20-20)</h2>
          <p className="text-gray-300 text-base mb-6 leading-relaxed">
            Màn hình đã được tạm thời khóa để bảo vệ đôi mắt của bạn.
            <br />
            Hãy di chuyển mắt **dõi theo điểm tròn màu vàng** đang chạy trên màn hình và **thực hiện chớp mắt rõ ràng 4 lần** để mở khóa.
          </p>

          {/* Progress indicators */}
          <div className="flex flex-col items-center justify-center gap-2 mb-4">
            <span className="text-xl font-bold text-yellow-400">
              Số lần chớp mắt: {blinksCount} / 4
            </span>
            <div className="w-64 h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-400 to-green-500 transition-all duration-300"
                style={{ width: `${(blinksCount / 4) * 100}%` }}
              />
            </div>
          </div>

          <button 
            onClick={() => onComplete(0)} 
            className="mt-6 px-5 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-all bg-gray-800 hover:bg-gray-700 bg-opacity-40 rounded-full"
          >
            Bỏ qua bài tập (Không nhận thưởng)
          </button>
        </div>
      ) : (
        // Exercise Success Screen
        <div className="text-center p-8 max-w-xl glass-card border border-green-500 border-opacity-30 bg-green-950 bg-opacity-20 text-white shadow-2xl scale-105 duration-300">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-500 bg-opacity-20 flex items-center justify-center text-green-300 mb-6 animate-bounce">
            <Award size={40} />
          </div>
          <h2 className="text-3xl font-extrabold text-green-400 mb-2">Đôi Mắt Tinh Anh!</h2>
          <p className="text-gray-300 text-lg mb-4">
            Bạn đã hoàn thành bài tập mắt và bảo vệ thị lực xuất sắc!
          </p>
          <div className="inline-block px-4 py-2 bg-yellow-400 text-gray-950 font-bold rounded-full animate-pulse">
            +200 XP Oliver
          </div>
        </div>
      )}

      {/* Golden Target Dot moving on screen */}
      {exerciseStatus === 'active' && (
        <div 
          className="absolute w-8 h-8 rounded-full bg-yellow-400 border-4 border-white shadow-lg flex items-center justify-center transition-all duration-75"
          style={{
            left: `${targetPos.x}%`,
            top: `${targetPos.y}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 20px #facc15',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
        </div>
      )}
    </div>
  );
};
export default EyeExercise;
