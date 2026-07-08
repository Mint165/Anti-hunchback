import React, { useState, useEffect } from 'react';
import { loadUserStats, buyItem, equipItem } from '../services/db';
import type { UserStats } from '../services/db';
import OliverPet from './OliverPet';
import { ShoppingBag, Star, Lock } from 'lucide-react';

export const SHOP_ITEMS = [
  { id: 'hat_scholar', name: 'Mũ Cử Nhân', slot: 'head', cost: 50, icon: '🎓' },
  { id: 'hat_crown_silver', name: 'Vương miện Bạc', slot: 'head', cost: 150, icon: '👑' },
  { id: 'hat_crown_gold', name: 'Vương miện Vàng', slot: 'head', cost: 500, icon: '👑' },
  { id: 'eyes_glasses', name: 'Kính Trí Thức', slot: 'eyes', cost: 30, icon: '👓' },
  { id: 'eyes_sunglasses', name: 'Kính Râm Ngầu', slot: 'eyes', cost: 100, icon: '🕶️' },
  { id: 'body_cape', name: 'Áo choàng Đỏ', slot: 'body', cost: 200, icon: '🦸' },
  { id: 'bg_aura', name: 'Hào Quang', slot: 'background', cost: 300, icon: '✨' },
];

export const PetShop: React.FC = () => {
  const [stats, setStats] = useState<UserStats>(() => loadUserStats());
  const [previewItems, setPreviewItems] = useState<Record<string, string>>(stats.equippedItems || {});

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(loadUserStats());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleBuy = (itemId: string, cost: number) => {
    if (buyItem(itemId, cost)) {
      setStats(loadUserStats());
    } else {
      alert('Không đủ Xu để mua vật phẩm này!');
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
                <div className="text-3xl text-center mb-2">{item.icon}</div>
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
