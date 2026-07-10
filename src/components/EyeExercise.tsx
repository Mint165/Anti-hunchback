import React, { useState, useEffect, useRef } from 'react';
import { Eye, Award, CheckCircle2 } from 'lucide-react';
import { addXP } from '../services/db';

interface EyeExerciseProps {
  isBlinking: boolean;
  poseLandmarks?: any[] | null;
  onComplete: (xpGained: number) => void;
}

export const EyeExercise: React.FC<EyeExerciseProps> = ({ isBlinking, poseLandmarks, onComplete }) => {
  const [blinksCount, setBlinksCount] = useState<number>(0);
  const [bambooCount, setBambooCount] = useState<number>(0);
  
  const [targetPos, setTargetPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [nosePos, setNosePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  
  const [exerciseStatus, setExerciseStatus] = useState<'active' | 'success'>('active');
  
  const wasBlinkingRef = useRef<boolean>(false);

  // Generate new bamboo position
  const spawnBamboo = () => {
    const min = 15;
    const max = 85;
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 bg-opacity-80 backdrop-blur-xl transition-all duration-500 overflow-hidden">
      
      {/* Exercise Active Screen Overlay */}
      {exerciseStatus === 'active' ? (
        <div className="text-center p-8 max-w-2xl glass-card border border-white border-opacity-10 text-white relative bg-opacity-10 shadow-2xl z-10 pointer-events-none">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-500 bg-opacity-20 flex items-center justify-center text-green-300 mb-6 animate-pulse">
            <span className="text-4xl">🐼</span>
          </div>
          
          <h2 className="text-3xl font-extrabold mb-4 tracking-tight text-green-400 drop-shadow-md">Panda Bamboo Gym!</h2>
          <p className="text-gray-100 text-base mb-8 leading-relaxed font-medium">
            Tới giờ giải lao rồi! Để bảo vệ mắt và cột sống cổ:
            <br />
            1. Dùng <strong>đầu (mũi)</strong> của bạn di chuyển điểm xanh lá để ăn lá tre.
            <br />
            2. Hãy <strong>chớp mắt 4 lần</strong> để thư giãn mắt.
          </p>

          {/* Progress indicators */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-yellow-400 mb-2 flex items-center gap-2">
                <Eye size={20} /> Chớp mắt: {blinksCount}/4
              </span>
              <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-400 to-yellow-200 transition-all duration-300"
                  style={{ width: `${Math.min(100, (blinksCount / 4) * 100)}%` }}
                />
              </div>
            </div>
            
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-green-400 mb-2 flex items-center gap-2">
                🌿 Ăn lá tre: {bambooCount}/5
              </span>
              <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-green-300 transition-all duration-300"
                  style={{ width: `${Math.min(100, (bambooCount / 5) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <button 
            onClick={() => onComplete(0)} 
            className="mt-6 px-5 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-all bg-gray-800 hover:bg-gray-700 bg-opacity-80 rounded-full pointer-events-auto shadow-lg"
          >
            Bỏ qua bài tập (Không nhận thưởng)
          </button>
        </div>
      ) : (
        // Exercise Success Screen
        <div className="text-center p-10 max-w-xl glass-card border border-green-500 border-opacity-40 bg-green-950 bg-opacity-40 text-white shadow-[0_0_50px_rgba(34,197,94,0.3)] scale-105 duration-300 z-10">
          <div className="w-24 h-24 mx-auto rounded-full bg-green-500 bg-opacity-20 flex items-center justify-center text-green-300 mb-6 animate-bounce shadow-inner">
            <CheckCircle2 size={50} />
          </div>
          <h2 className="text-4xl font-extrabold text-green-400 mb-4 drop-shadow-md">Tuyệt Vời!</h2>
          <p className="text-gray-100 text-xl mb-6 font-medium leading-relaxed">
            Bạn đã tập luyện cổ và thư giãn mắt rất tốt! Cột sống và thị lực của bạn đang được bảo vệ.
          </p>
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-950 font-black text-xl rounded-full shadow-lg animate-pulse">
            <Award size={24} /> +300 XP
          </div>
        </div>
      )}

      {/* Game Area (Only active during exercise) */}
      {exerciseStatus === 'active' && (
        <>
          {/* Target Bamboo */}
          <div 
            className="absolute flex items-center justify-center transition-all duration-300 ease-out"
            style={{
              left: `${targetPos.x}%`,
              top: `${targetPos.y}%`,
              transform: 'translate(-50%, -50%)',
              width: '60px',
              height: '60px',
            }}
          >
            <div className="text-5xl animate-swing drop-shadow-[0_0_15px_rgba(74,222,128,0.8)] filter">🌿</div>
          </div>

          {/* Player Nose Tracker (Panda Face) */}
          <div 
            className="absolute flex items-center justify-center transition-transform duration-75"
            style={{
              left: `${nosePos.x}%`,
              top: `${nosePos.y}%`,
              transform: 'translate(-50%, -50%)',
              width: '50px',
              height: '50px',
            }}
          >
            <div className="text-4xl drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]">🐼</div>
          </div>
        </>
      )}
    </div>
  );
};
export default EyeExercise;
