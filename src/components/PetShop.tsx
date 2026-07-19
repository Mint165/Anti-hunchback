import React, { useState, useEffect } from 'react';
import { loadUserStats, buyItem, equipItem } from '../services/db';
import type { UserStats } from '../services/db';
import { ShoppingBag, Lock, Coins } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import OliverPet from './OliverPet';
import { motion } from 'framer-motion';

export const SHOP_ITEMS = [
  { id: 'hat_scholar', name: 'Mũ Cử Nhân', slot: 'head', cost: 50, icon: '🎓' },
  { id: 'hat_crown_silver', name: 'Vương miện Bạc', slot: 'head', cost: 150, icon: '👑' },
  { id: 'hat_crown_gold', name: 'Vương miện Vàng', slot: 'head', cost: 500, icon: '👑' },
  { id: 'eyes_glasses', name: 'Kính Trí Thức', slot: 'eyes', cost: 30, icon: '👓' },
  { id: 'eyes_sunglasses', name: 'Kính Râm Ngầu', slot: 'eyes', cost: 100, icon: '🕶️' },
  { id: 'body_cape', name: 'Áo choàng Đỏ', slot: 'body', cost: 200, icon: '🦸' },
  { id: 'aura_fire', name: 'Hào Quang Lửa', slot: 'aura', cost: 300, icon: '🔥' },
  { id: 'aura_ice', name: 'Hào Quang Băng', slot: 'aura', cost: 300, icon: '❄️' },
  { id: 'aura_electric', name: 'Hào Quang Điện', slot: 'aura', cost: 300, icon: '⚡' },
];

const renderItemIcon = (itemId: string) => {
  switch (itemId) {
    case 'hat_scholar':
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12 mx-auto overflow-visible">
          <polygon points="10,55 50,30 90,55 50,80" fill="#1F2937" />
          <rect x="35" y="55" width="30" height="25" fill="#1F2937" />
          <path d="M 85 55 L 95 85" stroke="#FBBF24" strokeWidth="5" />
        </svg>
      );
    case 'hat_crown_silver':
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12 mx-auto overflow-visible">
          <polygon points="10,80 30,20 50,60 70,20 90,80" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="6" strokeLinejoin="round" />
        </svg>
      );
    case 'hat_crown_gold':
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12 mx-auto overflow-visible">
          <polygon points="10,80 30,20 50,60 70,20 90,80" fill="#FBBF24" stroke="#D97706" strokeWidth="6" strokeLinejoin="round" />
          <circle cx="10" cy="80" r="8" fill="#EF4444" />
          <circle cx="30" cy="20" r="10" fill="#3B82F6" />
          <circle cx="50" cy="60" r="8" fill="#10B981" />
          <circle cx="70" cy="20" r="10" fill="#3B82F6" />
          <circle cx="90" cy="80" r="8" fill="#EF4444" />
        </svg>
      );
    case 'eyes_glasses':
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12 mx-auto overflow-visible" fill="none" stroke="#1F2937" strokeWidth="8">
          <circle cx="30" cy="50" r="20" />
          <circle cx="70" cy="50" r="20" />
          <path d="M 50 50 L 50 50" />
          <path d="M 10 50 L 30 50 M 70 50 L 90 50" />
        </svg>
      );
    case 'eyes_sunglasses':
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12 mx-auto overflow-visible">
          <path d="M 10 50 Q 30 30 45 50 Q 30 70 10 50" fill="#111827" stroke="#000" strokeWidth="3" />
          <path d="M 55 50 Q 75 30 90 50 Q 75 70 55 50" fill="#111827" stroke="#000" strokeWidth="3" />
          <path d="M 45 45 L 55 45" stroke="#111827" strokeWidth="6" />
        </svg>
      );
    case 'body_cape':
      return (
        <svg viewBox="0 0 100 100" className="w-12 h-12 mx-auto overflow-visible">
          <path d="M 30 30 Q 10 90 30 95 Q 50 100 70 95 Q 90 90 70 30 Z" fill="#EF4444" opacity="0.9" />
        </svg>
      );
    case 'aura_fire':
      return (
        <div className="w-10 h-10 mx-auto rounded-full shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse" style={{ backgroundColor: '#EF444450' }} />
      );
    case 'aura_ice':
      return (
        <div className="w-10 h-10 mx-auto rounded-full shadow-[0_0_20px_rgba(96,165,250,0.8)] animate-pulse" style={{ backgroundColor: '#60A5FA50' }} />
      );
    case 'aura_electric':
      return (
        <div className="w-10 h-10 mx-auto rounded-full shadow-[0_0_20px_rgba(252,211,77,0.8)] animate-pulse" style={{ backgroundColor: '#FCD34D50' }} />
      );
    default:
      return null;
  }
};


export const PetShop: React.FC = () => {
  const [stats, setStats] = useState<UserStats>(() => loadUserStats());
  const [category, setCategory] = useState<string>('all');
  const [previewItems, setPreviewItems] = useState<Record<string, string>>(stats.equippedItems || {});
  const { t: _t } = useLanguage();

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(loadUserStats());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const playSuccessSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (start: number, freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + start + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + 0.3);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + 0.3);
      };
      playTone(0, 523.25); // C5
      playTone(0.1, 659.25); // E5
      playTone(0.2, 783.99); // G5
      playTone(0.3, 1046.50); // C6
      setTimeout(() => ctx.close(), 1000);
    } catch {}
  };

  const handleBuy = (itemId: string, cost: number) => {
    if (buyItem(itemId, cost)) {
      setStats(loadUserStats());
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 10000 });
      playSuccessSound();
      toast.success('Mua vật phẩm thành công! 🎉');
    } else {
      toast.error('Không đủ Xu để mua vật phẩm này!');
    }
  };

  const handleEquipToggle = (slot: string, itemId: string) => {
    if (stats.equippedItems[slot] === itemId) {
      equipItem(slot, null);
      setPreviewItems(prev => {
        const newPreview = { ...prev };
        delete newPreview[slot];
        return newPreview;
      });
    } else {
      equipItem(slot, itemId);
      setPreviewItems(prev => ({ ...prev, [slot]: itemId }));
    }
    setStats(loadUserStats());
  };

  const handlePreview = (slot: string, itemId: string) => {
    if (previewItems[slot] === itemId && stats.equippedItems[slot] !== itemId) {
      // Revert preview to equipped
      setPreviewItems(prev => {
        const newPreview = { ...prev };
        if (stats.equippedItems[slot]) {
          newPreview[slot] = stats.equippedItems[slot];
        } else {
          delete newPreview[slot];
        }
        return newPreview;
      });
    } else {
      setPreviewItems(prev => ({ ...prev, [slot]: itemId }));
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-black mb-2 flex items-center gap-3" style={{ color: 'var(--text-main)' }}>
            <ShoppingBag size={32} style={{ color: 'var(--accent)' }} /> {_t('shop.title')}
          </h1>
          <p style={{ color: 'var(--text-muted)' }} className="font-medium text-lg">{_t('shop.desc')}</p>
        </div>
        
        <div className="flex items-center gap-4 bg-yellow-50 dark:bg-yellow-900/20 px-6 py-4 rounded-2xl border-2 border-yellow-200 dark:border-yellow-700/50 shadow-inner">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-yellow-600 dark:text-yellow-500 uppercase tracking-wider">{_t('shop.yourCoins')}</span>
            <span className="text-3xl font-black text-yellow-500 flex items-center gap-2">
              <Coins size={28} /> {stats.coins}
            </span>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-4 mb-8 overflow-x-auto pb-4 scrollbar-hide">
        {['all', 'head', 'eyes', 'body', 'aura'].map((cat) => (
          <button 
            key={cat}
            onClick={() => setCategory(cat as any)}
            className={`px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${
              category === cat 
                ? 'bg-accent text-white shadow-lg shadow-accent/30 scale-105' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {cat === 'all' ? 'Tất cả' : _t(`shop.category.${cat}`)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Preview Panel */}
        <div className="lg:col-span-1 flex flex-col items-center justify-center p-6 rounded-3xl" style={{ background: 'var(--bg-page)', border: '2px solid rgba(124,58,237,0.1)' }}>
          <div className="relative mb-6 w-56 h-56 flex items-center justify-center">
             <OliverPet state="good" size={240} equippedItems={previewItems} />
          </div>
          <p className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{_t('shop.fittingRoom')}</p>
        </div>

        {/* Shop Grid */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {SHOP_ITEMS.map((item, index) => {
            const isUnlocked = stats.unlockedItems?.includes(item.id);
            const isEquipped = stats.equippedItems?.[item.slot] === item.id;
            const isPreviewing = previewItems[item.slot] === item.id;

            return (
              <motion.div 
                key={item.id} 
                className="flex flex-col p-4 rounded-3xl transition-all cursor-pointer relative overflow-hidden"
                style={{ 
                  background: isEquipped ? 'var(--accent-light)' : isPreviewing ? 'var(--primary-light)' : 'var(--bg-card)',
                  border: isEquipped ? '2px solid rgba(245,158,11,0.3)' : isPreviewing ? '2px solid rgba(124,58,237,0.3)' : '2px solid rgba(124,58,237,0.1)'
                }}
                onClick={() => isUnlocked ? handleEquipToggle(item.slot, item.id) : handlePreview(item.slot, item.id)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -5, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="flex items-center justify-center mb-4 h-16 transform transition-transform hover:scale-110">{renderItemIcon(item.id)}</div>
                <h4 className="text-sm font-bold text-center mb-3" style={{ color: 'var(--text-main)' }}>{item.name}</h4>
                
                <div className="mt-auto pt-2 flex items-center justify-center">
                  {!isUnlocked ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleBuy(item.id, item.cost); }}
                      className="btn-3d btn-3d-secondary w-full flex items-center justify-center gap-2 py-2 px-0 text-xs"
                    >
                      <Lock size={14} /> {item.cost} Xu
                    </button>
                  ) : isEquipped ? (
                    <span className="text-xs font-black py-2 rounded-xl w-full text-center uppercase tracking-wider" style={{ background: 'var(--accent)', color: 'white' }}>{_t('shop.equipped')}</span>
                  ) : (
                    <span className="text-xs font-bold py-2 rounded-xl w-full text-center" style={{ background: 'var(--bg-page)', color: 'var(--text-secondary)' }}>{_t('shop.owned')}</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        
      </div>
    </div>
  );
};

export default PetShop;
