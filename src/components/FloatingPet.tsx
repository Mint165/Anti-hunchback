import React, { useState, useEffect } from 'react';
import { usePostureContext } from '../contexts/PostureContext';
import OliverPet, { type PetState } from './OliverPet';
import { loadUserStats } from '../services/db';
import { Maximize2, Minimize2 } from 'lucide-react';

export const FloatingPet: React.FC = () => {
  const { metrics, hasStarted, alertLevel } = usePostureContext();
  const [isMinimized, setIsMinimized] = useState(false);
  const [stats, setStats] = useState(() => loadUserStats());

  useEffect(() => {
    // Poll for stats changes to keep level up to date
    const interval = setInterval(() => {
      setStats(loadUserStats());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!hasStarted) {
    return null; // Do not show floating pet if session hasn't started globally
  }

  const getPetState = (): PetState => {
    if (!hasStarted) return 'sleep';
    if (alertLevel === 'BREAK_TIME' || alertLevel === 'STRONG_WARNING') return 'tired';
    if (metrics?.isWritingMode) return 'writing';
    if (metrics && metrics.eyeDistanceCm < 50) return 'close';
    if (metrics && (metrics.slouchAngle > 15 || metrics.shoulderTilt > 7)) return 'slouch';
    if (metrics && metrics.neckAngle > 20 && !metrics.isWritingMode) return 'tired'; // head tilt
    if (metrics?.state === 'GOOD_POSTURE') return 'good';
    return 'good';
  };

  const state = getPetState();

  if (isMinimized) {
    return (
      <div 
        className="fixed bottom-6 right-6 z-50 bg-white p-3 rounded-full shadow-lg border border-gray-200 cursor-pointer hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center"
        onClick={() => setIsMinimized(false)}
        style={{ width: '60px', height: '60px' }}
      >
        <div className="scale-50 origin-center -ml-16 -mt-16 pointer-events-none">
          <OliverPet state={state} size={150} petLevel={stats.petLevel} />
        </div>
        <div className="absolute top-0 right-0 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
          <Maximize2 size={10} />
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-transform duration-300 ${state === 'slouch' || state === 'close' ? 'animate-bounce' : ''}`}>
      <div className="relative group">
        <button 
          onClick={() => setIsMinimized(true)}
          className="absolute -top-2 -right-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <Minimize2 size={14} />
        </button>
        <div className="transform scale-75 origin-bottom-right">
          <OliverPet state={state} size={180} petLevel={stats.petLevel} />
        </div>
      </div>
    </div>
  );
};

export default FloatingPet;
