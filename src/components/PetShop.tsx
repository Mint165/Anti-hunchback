import React, { useState, useEffect } from 'react';
import { loadUserStats, buyItem, equipItem } from '../services/db';
import type { UserStats } from '../services/db';
import OliverPet from './OliverPet';
import { ShoppingBag, Star, Lock } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';

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
  const [previewItems, setPreviewItems] = useState<Record<string, string>>(stats.equippedItems || {});

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
    <div className="premium-card bg-white p-6">
      <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingBag size={24} className="text-orange-500" /> Cửa hàng Oliver
        </h3>
        <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-full border border-orange-100">
          <Star size={18} className="text-orange-500 fill-orange-500" />
          <span className="font-black text-orange-600">{stats.coins} Xu</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Preview Panel */}
        <div className="md:col-span-1 flex flex-col items-center justify-center p-4 bg-gray-50 rounded-2xl border border-gray-200">
          <div className="relative mb-4 w-48 h-48 flex items-center justify-center">
             <OliverPet state="good" size={200} equippedItems={previewItems} />
          </div>
          <p className="text-sm font-semibold text-gray-500">Phòng Thử Đồ</p>
        </div>

        {/* Shop Grid */}
        <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2">
          {SHOP_ITEMS.map(item => {
            const isUnlocked = stats.unlockedItems?.includes(item.id);
            const isEquipped = stats.equippedItems?.[item.slot] === item.id;
            const isPreviewing = previewItems[item.slot] === item.id;

            return (
              <div 
                key={item.id} 
                className={`flex flex-col p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  isEquipped ? 'border-orange-500 bg-orange-50' : 
                  isPreviewing ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-300 bg-white'
                }`}
                onClick={() => isUnlocked ? handleEquipToggle(item.slot, item.id) : handlePreview(item.slot, item.id)}
              >
                <div className="flex items-center justify-center mb-3 h-12">{renderItemIcon(item.id)}</div>
                <h4 className="text-xs font-bold text-gray-800 text-center mb-1">{item.name}</h4>
                
                <div className="mt-auto pt-2 flex items-center justify-center">
                  {!isUnlocked ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleBuy(item.id, item.cost); }}
                      className="flex items-center gap-1 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-gray-700 w-full justify-center"
                    >
                      <Lock size={12} /> {item.cost} Xu
                    </button>
                  ) : isEquipped ? (
                    <span className="text-xs font-bold text-orange-600 bg-orange-100 px-3 py-1 rounded-lg w-full text-center">Đang mặc</span>
                  ) : (
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-lg w-full text-center">Đã sở hữu</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
      </div>
    </div>
  );
};

export default PetShop;
