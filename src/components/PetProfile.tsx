import React, { useState, useEffect } from 'react';
import { loadUserStats, getBadgesStatus } from '../services/db';
import OliverPet from './OliverPet';
import PetShop from './PetShop';
import { Award, Heart, Eye, Activity, Info, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const PetProfile: React.FC = () => {
  const { t: _t } = useLanguage();
  const [stats, setStats] = useState(() => loadUserStats());
  const [badges, setBadges] = useState(() => getBadgesStatus());
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    // Only load once when mounted, and listen to visibility change (same fix as FloatingPet)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setStats(loadUserStats());
        setBadges(getBadgesStatus());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const getXpThreshold = (level: number) => {
    if (level >= 5) return 5000;
    if (level === 4) return 5000;
    if (level === 3) return 3000;
    if (level === 2) return 1500;
    return 500;
  };

  const getPreviousXpThreshold = (level: number) => {
    if (level >= 5) return 5000;
    if (level === 4) return 3000;
    if (level === 3) return 1500;
    if (level === 2) return 500;
    return 0;
  };

  const currentLevelXp = stats.petXp - getPreviousXpThreshold(stats.petLevel);
  const xpForNextLevel = getXpThreshold(stats.petLevel) - getPreviousXpThreshold(stats.petLevel);
  const progressPercent = stats.petLevel >= 5 ? 100 : Math.min(100, Math.max(0, (currentLevelXp / xpForNextLevel) * 100));

  return (
    <div className="p-8 max-w-4xl mx-auto min-h-screen">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-gray-800">Hồ Sơ Oliver</h1>
        <p className="text-gray-500">Người bạn đồng hành bảo vệ tư thế của bé</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Avatar & Progress */}
        <div className="premium-card bg-white p-8 flex flex-col items-center justify-center relative">
          <button 
            onClick={() => setShowInfo(true)}
            className="absolute top-4 right-4 p-2 bg-blue-50 text-blue-500 hover:bg-blue-100 rounded-full transition-colors shadow-sm"
          >
            <Info size={20} />
          </button>
          
          {/* Custom speech bubble */}
          <div className="mb-4 bg-green-50 dark:bg-slate-700 text-green-700 dark:text-green-300 border border-green-100 dark:border-slate-600 px-4 py-2 rounded-2xl text-sm font-semibold shadow-sm relative">
            Tớ luôn sẵn sàng đồng hành cùng bạn!
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-green-50 dark:bg-slate-700 border-r border-b border-green-100 dark:border-slate-600 rotate-45" />
          </div>
          
          <div className="w-48 h-48 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-inner relative border-4 border-green-100">
             <div className="scale-75 absolute -bottom-4">
               <OliverPet state="good" size={240} petLevel={stats.petLevel} equippedItems={stats.equippedItems} hideBubble={true} hideBadge={true} />
             </div>
          </div>
          
          <h2 className="text-2xl font-black text-gray-800">Oliver</h2>
          <div className="pill-tag pill-primary mt-2 mb-6 font-bold text-sm">Level {stats.petLevel}</div>

          <div className="w-full max-w-sm">
            <div className="flex justify-between text-sm font-bold text-gray-600 mb-2">
               <span>XP Thú cưng</span>
               <span>{stats.petLevel >= 5 ? 'MAX' : `${stats.petXp} / ${getXpThreshold(stats.petLevel)}`}</span>
            </div>
            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-gradient-to-r from-green-400 to-emerald-600 rounded-full transition-all duration-1000" 
                 style={{ width: `${progressPercent}%` }} 
               />
            </div>
            <p className="text-xs text-center text-gray-400 mt-3">Giữ tư thế chuẩn liên tục để tăng XP cho Oliver nhé!</p>
          </div>
        </div>

        {/* Right Column: Stats & Badges */}
        <div className="flex flex-col gap-8">
          
          {/* Health Stats */}
          <div className="premium-card bg-white p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Activity size={20} className="text-blue-500" /> Chỉ Số Sức Khỏe Tổng Quan
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 text-red-500 rounded-lg"><Heart size={18} /></div>
                  <span className="font-semibold text-gray-700">Sức khỏe lưng</span>
                </div>
                <span className="font-black text-gray-800">90%</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-500 rounded-lg"><Eye size={18} /></div>
                  <span className="font-semibold text-gray-700">Sức khỏe mắt</span>
                </div>
                <span className="font-black text-gray-800">88%</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 text-green-500 rounded-lg"><Award size={18} /></div>
                  <span className="font-semibold text-gray-700">Tư thế</span>
                </div>
                <span className="font-black text-gray-800">95%</span>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="premium-card bg-white p-6 flex-1">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Award size={20} className="text-purple-500" /> Huy Hiệu Đạt Được
            </h3>
            <div className="grid grid-cols-4 gap-4">
              {badges.map(badge => (
                <div 
                  key={badge.id} 
                  className={`flex flex-col items-center text-center p-2 rounded-xl transition-all ${badge.unlocked ? 'bg-purple-50 border border-purple-100' : 'opacity-40 grayscale'}`}
                  title={badge.description}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${badge.unlocked ? 'bg-purple-200 text-purple-600' : 'bg-gray-200 text-gray-500'}`}>
                    <Award size={24} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 leading-tight">{badge.name}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <div className="mt-8">
        <PetShop />
      </div>

      {showInfo && (
        <div className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl relative animate-slide-in-right">
            <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-full transition-colors">
              <X size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
            <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-4">Hướng dẫn Thú cưng</h3>
            <div className="space-y-4 text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
              <p><strong>Làm sao để tăng XP?</strong><br/>Hãy giữ tư thế ngồi thẳng, mắt cách màn hình {'>'}50cm. Mỗi phút ngồi chuẩn bạn sẽ được cộng XP!</p>
              <p><strong>Oliver sẽ phản ứng ra sao?</strong><br/>Oliver sẽ vui vẻ (nhảy múa) khi bạn ngồi đúng. Nếu bạn cúi quá gần, Oliver sẽ nhíu mày nhắc nhở.</p>
              <p><strong>Cách đổi vật phẩm:</strong><br/>Sử dụng XP đạt được để mở khóa kính, mũ, áo ở Pet Shop bên dưới. Level càng cao, vật phẩm càng hiếm!</p>
            </div>
            <button onClick={() => setShowInfo(false)} className="w-full btn-primary py-3 mt-6">Đã hiểu</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PetProfile;
