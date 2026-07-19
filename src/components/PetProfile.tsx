import React, { useState, useEffect } from 'react';
import { loadUserStats, getBadgesStatus } from '../services/db';
import OliverPet from './OliverPet';
import PetShop from './PetShop';
import { Award, Heart, Eye, Activity, Info, X, Trophy } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import TiltCard from './ui/TiltCard';
import { motion, AnimatePresence } from 'framer-motion';

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
    <motion.div 
      className="p-4 md:p-8 max-w-6xl mx-auto min-h-screen"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black mb-2" style={{ color: 'var(--text-main)' }}>{_t('pet.profileTitle')}</h1>
        <p style={{ color: 'var(--text-muted)' }} className="font-medium">{_t('pet.profileDesc')}</p>
      </div>

      <div className="sv-grid mb-10">
        {/* Left Column: Avatar & Progress (Main Feature) */}
        <div className="md:col-span-8">
          <TiltCard className="h-full flex flex-col items-center justify-center p-8 relative" glowColor="var(--primary-light)">
            <motion.button 
              onClick={() => setShowInfo(true)}
              className="absolute top-6 right-6 p-3 rounded-full"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Info size={24} />
            </motion.button>
            
            {/* Custom speech bubble */}
            <motion.div 
              className="mb-8 px-6 py-3 rounded-2xl text-sm font-bold shadow-sm relative"
              style={{ background: 'var(--secondary-light)', color: 'var(--secondary)', border: '2px solid rgba(16,185,129,0.2)' }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
            >
              {_t('pet.message')}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45" style={{ background: 'var(--secondary-light)', borderRight: '2px solid rgba(16,185,129,0.2)', borderBottom: '2px solid rgba(16,185,129,0.2)' }} />
            </motion.div>
            
            <div className="w-64 h-64 rounded-full flex items-center justify-center mb-8 relative overflow-hidden" style={{ background: 'var(--bg-page)', border: '4px solid var(--secondary-light)', boxShadow: 'inset 0 10px 30px rgba(0,0,0,0.05)' }}>
               <div className="w-full h-full flex items-center justify-center pt-8">
                 <OliverPet state="good" size={260} petLevel={stats.petLevel} equippedItems={stats.equippedItems} hideBubble={true} hideBadge={true} />
               </div>
            </div>
            
            <h2 className="text-3xl font-black mb-2" style={{ color: 'var(--text-main)' }}>Oliver</h2>
            <div className="pill-tag pill-primary mb-8 font-black text-lg px-6 py-2">Level {stats.petLevel}</div>

            <div className="w-full max-w-md">
              <div className="flex justify-between text-sm font-black mb-3" style={{ color: 'var(--text-secondary)' }}>
                 <span>{_t('pet.petXp')}</span>
                 <span style={{ color: 'var(--primary)' }}>{stats.petLevel >= 5 ? 'MAX' : `${stats.petXp} / ${getXpThreshold(stats.petLevel)}`}</span>
              </div>
              <div className="w-full h-5 rounded-full overflow-hidden" style={{ background: 'var(--primary-light)' }}>
                  <motion.div 
                   className="h-full rounded-full" 
                   style={{ background: 'linear-gradient(90deg, var(--secondary), var(--primary))' }}
                   initial={{ width: 0 }}
                   animate={{ width: `${progressPercent}%` }} 
                   transition={{ duration: 1.5, ease: "easeOut" }}
                 />
              </div>
              <p className="text-xs text-center mt-4 font-bold" style={{ color: 'var(--text-muted)' }}>{_t('pet.keepPosture')}</p>
            </div>
          </TiltCard>
        </div>

        {/* Right Column: Stats & Badges */}
        <div className="md:col-span-4 flex flex-col gap-6">
          
          {/* Health Stats */}
          <TiltCard className="p-6">
            <h3 className="text-xl font-black mb-6 flex items-center gap-3" style={{ color: 'var(--text-main)' }}>
              <Activity size={24} style={{ color: 'var(--primary)' }} /> {_t('pet.overallStats')}
            </h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}><Heart size={20} /></div>
                  <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>{_t('pet.backHealth')}</span>
                </div>
                <span className="font-black text-xl" style={{ color: 'var(--text-main)' }}>90%</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }}><Eye size={20} /></div>
                  <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>{_t('pet.eyeHealth')}</span>
                </div>
                <span className="font-black text-xl" style={{ color: 'var(--text-main)' }}>88%</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl" style={{ background: 'var(--secondary-light)', color: 'var(--secondary)' }}><Award size={20} /></div>
                  <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>{_t('pet.posture')}</span>
                </div>
                <span className="font-black text-xl" style={{ color: 'var(--text-main)' }}>95%</span>
              </div>
            </div>
          </TiltCard>

          {/* Badges */}
          <TiltCard className="p-6 flex-1">
            <h3 className="text-xl font-black mb-6 flex items-center gap-3" style={{ color: 'var(--text-main)' }}>
              <Trophy size={24} style={{ color: '#F59E0B' }} /> {_t('pet.myBadges')}
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {badges.map((badge, i) => (
                <motion.div 
                  key={badge.id} 
                  className={`flex flex-col items-center text-center p-3 rounded-2xl transition-all ${badge.unlocked ? '' : 'opacity-40 grayscale'}`}
                  style={{ background: badge.unlocked ? 'var(--bg-page)' : 'transparent', border: badge.unlocked ? '2px solid rgba(124,58,237,0.1)' : 'none' }}
                  title={badge.description}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: badge.unlocked ? 1 : 0.4, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${badge.unlocked ? '' : 'bg-gray-200 text-gray-500'}`} style={{ background: badge.unlocked ? 'var(--primary-light)' : '', color: badge.unlocked ? 'var(--primary)' : '' }}>
                    <Award size={28} />
                  </div>
                  <span className="text-xs font-black leading-tight" style={{ color: 'var(--text-secondary)' }}>{badge.name}</span>
                </motion.div>
              ))}
            </div>
          </TiltCard>

        </div>
      </div>

      <div className="mt-10">
        <PetShop />
      </div>

      <AnimatePresence>
      {showInfo && (
        <motion.div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="rounded-3xl w-full max-w-md p-8 relative"
            style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-xl)', border: '1px solid rgba(124,58,237,0.1)' }}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
          >
            <motion.button 
              onClick={() => setShowInfo(false)} 
              className="absolute top-6 right-6 p-2 rounded-full"
              style={{ background: 'var(--bg-page)', color: 'var(--text-muted)' }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X size={20} />
            </motion.button>
            <h3 className="text-2xl font-black mb-6" style={{ color: 'var(--text-main)' }}>Hướng dẫn Thú cưng</h3>
            <div className="space-y-6 text-sm leading-relaxed font-medium" style={{ color: 'var(--text-secondary)' }}>
              <div>
                <strong className="text-lg block mb-1" style={{ color: 'var(--primary)' }}>Làm sao để tăng XP?</strong>
                Hãy giữ tư thế ngồi thẳng, mắt cách màn hình {'>'}50cm. Mỗi phút ngồi chuẩn bạn sẽ được cộng XP!
              </div>
              <div>
                <strong className="text-lg block mb-1" style={{ color: 'var(--primary)' }}>Oliver sẽ phản ứng ra sao?</strong>
                Oliver sẽ vui vẻ (nhảy múa) khi bạn ngồi đúng. Nếu bạn cúi quá gần, Oliver sẽ nhíu mày nhắc nhở.
              </div>
              <div>
                <strong className="text-lg block mb-1" style={{ color: 'var(--primary)' }}>Cách đổi vật phẩm:</strong>
                Sử dụng XP đạt được để mở khóa kính, mũ, áo ở Pet Shop bên dưới. Level càng cao, vật phẩm càng hiếm!
              </div>
            </div>
            <motion.button 
              onClick={() => setShowInfo(false)} 
              className="w-full btn-3d btn-3d-primary py-4 mt-8 text-lg"
              whileTap={{ scale: 0.95 }}
            >
              Đã hiểu
            </motion.button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PetProfile;
