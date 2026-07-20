import React, { useState, useEffect } from 'react';
import { loadUserStats, buyItem, equipItem } from '../services/db';
import type { UserStats } from '../services/db';
import { ShoppingBag, Lock, Coins } from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import OliverPet from './OliverPet';
import { motion } from 'framer-motion';
import styles from './PetShop.module.css';

export const SHOP_ITEMS = [
  { id: 'hat_scholar', nameKey: 'shop.item.hat_scholar', slot: 'head', cost: 50, icon: '🎓' },
  { id: 'hat_crown_silver', nameKey: 'shop.item.hat_crown_silver', slot: 'head', cost: 150, icon: '👑' },
  { id: 'hat_crown_gold', nameKey: 'shop.item.hat_crown_gold', slot: 'head', cost: 500, icon: '👑' },
  { id: 'eyes_glasses', nameKey: 'shop.item.eyes_glasses', slot: 'eyes', cost: 30, icon: '👓' },
  { id: 'eyes_sunglasses', nameKey: 'shop.item.eyes_sunglasses', slot: 'eyes', cost: 100, icon: '🕶️' },
  { id: 'body_cape', nameKey: 'shop.item.body_cape', slot: 'body', cost: 200, icon: '🦸' },
  { id: 'aura_fire', nameKey: 'shop.item.aura_fire', slot: 'aura', cost: 300, icon: '🔥' },
  { id: 'aura_ice', nameKey: 'shop.item.aura_ice', slot: 'aura', cost: 300, icon: '❄️' },
  { id: 'aura_electric', nameKey: 'shop.item.aura_electric', slot: 'aura', cost: 300, icon: '⚡' },
];

const renderItemIcon = (itemId: string, large: boolean = false) => {
  const sizeClass = large ? 'w-20 h-20' : 'w-12 h-12';
  switch (itemId) {
    case 'hat_scholar':
      return (
        <svg viewBox="0 0 100 100" className={`${sizeClass} mx-auto overflow-visible`}>
          <polygon points="10,55 50,30 90,55 50,80" fill="#1F2937" />
          <rect x="35" y="55" width="30" height="25" fill="#1F2937" />
          <path d="M 85 55 L 95 85" stroke="#FBBF24" strokeWidth="5" />
        </svg>
      );
    case 'hat_crown_silver':
      return (
        <svg viewBox="0 0 100 100" className={`${sizeClass} mx-auto overflow-visible`}>
          <polygon points="10,80 30,20 50,60 70,20 90,80" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="6" strokeLinejoin="round" />
        </svg>
      );
    case 'hat_crown_gold':
      return (
        <svg viewBox="0 0 100 100" className={`${sizeClass} mx-auto overflow-visible`}>
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
        <svg viewBox="0 0 100 100" className={`${sizeClass} mx-auto overflow-visible`} fill="none" stroke="#1F2937" strokeWidth="8">
          <circle cx="30" cy="50" r="20" />
          <circle cx="70" cy="50" r="20" />
          <path d="M 50 50 L 50 50" />
          <path d="M 10 50 L 30 50 M 70 50 L 90 50" />
        </svg>
      );
    case 'eyes_sunglasses':
      return (
        <svg viewBox="0 0 100 100" className={`${sizeClass} mx-auto overflow-visible`}>
          <path d="M 10 50 Q 30 30 45 50 Q 30 70 10 50" fill="#111827" stroke="#000" strokeWidth="3" />
          <path d="M 55 50 Q 75 30 90 50 Q 75 70 55 50" fill="#111827" stroke="#000" strokeWidth="3" />
          <path d="M 45 45 L 55 45" stroke="#111827" strokeWidth="6" />
        </svg>
      );
    case 'body_cape':
      return (
        <svg viewBox="0 0 100 100" className={`${sizeClass} mx-auto overflow-visible`}>
          <path d="M 30 30 Q 10 90 30 95 Q 50 100 70 95 Q 90 90 70 30 Z" fill="#EF4444" opacity="0.9" />
        </svg>
      );
    case 'aura_fire':
      return (
        <div className={`${large ? 'w-16 h-16' : 'w-10 h-10'} mx-auto rounded-full shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse`} style={{ backgroundColor: '#EF444450' }} />
      );
    case 'aura_ice':
      return (
        <div className={`${large ? 'w-16 h-16' : 'w-10 h-10'} mx-auto rounded-full shadow-[0_0_20px_rgba(96,165,250,0.8)] animate-pulse`} style={{ backgroundColor: '#60A5FA50' }} />
      );
    case 'aura_electric':
      return (
        <div className={`${large ? 'w-16 h-16' : 'w-10 h-10'} mx-auto rounded-full shadow-[0_0_20px_rgba(252,211,77,0.8)] animate-pulse`} style={{ backgroundColor: '#FCD34D50' }} />
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
    // Refresh stats when tab becomes visible or when window regains focus,
    // instead of polling every 2s (performance).
    const refresh = () => setStats(loadUserStats());
    refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refresh);
    };
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
      toast.success(_t('shop.buySuccess'));
    } else {
      toast.error(_t('shop.notEnoughCoins'));
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

  const filteredItems = category === 'all' ? SHOP_ITEMS : SHOP_ITEMS.filter(i => i.slot === category);

  return (
    <div className={styles.shop}>
      <div className={styles.shopHeader}>
        <div>
          <h1 className={styles.shopTitle}>
            <ShoppingBag size={32} style={{ color: 'var(--accent)' }} /> {_t('shop.title')}
          </h1>
          <p className={styles.shopDesc}>{_t('shop.desc')}</p>
        </div>

        <div className={styles.coinsPill}>
          <div className="flex flex-col">
            <span className={styles.coinsLabel}>{_t('shop.yourCoins')}</span>
            <span className={styles.coinsValue}>
              <Coins size={28} /> {stats.coins}
            </span>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className={styles.tabs}>
        {['all', 'head', 'eyes', 'body', 'aura'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`${styles.tab} ${category === cat ? styles.tabActive : ''}`}
          >
            {_t(`shop.category.${cat}`)}
          </button>
        ))}
      </div>

      {/* Preview banner — moved below tabs (was left column) */}
      <div className={styles.previewBanner}>
        <div className={styles.previewWrap}>
          <OliverPet state="good" size={200} equippedItems={previewItems} lowDetail />
        </div>
        <p className={styles.previewLabel}>{_t('shop.fittingRoom')}</p>
      </div>

      <div className={styles.shopGrid}>
        {/* Shop Grid */}
        <div className={styles.items}>
          {filteredItems.map((item, index) => {
            const isUnlocked = stats.unlockedItems?.includes(item.id);
            const isEquipped = stats.equippedItems?.[item.slot] === item.id;
            const isPreviewing = previewItems[item.slot] === item.id;
            const isLargeIcon = category !== 'all';

            return (
              <motion.div
                key={item.id}
                className={`${styles.item} ${isEquipped ? styles.itemEquipped : isPreviewing ? styles.itemPreviewing : ''}`}
                onClick={() => isUnlocked ? handleEquipToggle(item.slot, item.id) : handlePreview(item.slot, item.id)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -5, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                whileTap={{ scale: 0.95 }}
              >
                <div className={`${styles.itemIconWrap} ${isLargeIcon ? styles.itemIconWrapLarge : ''}`}>
                  {renderItemIcon(item.id, isLargeIcon)}
                </div>
                <h4 className={styles.itemName}>{_t(item.nameKey)}</h4>

                <div className={styles.itemFooter}>
                  {!isUnlocked ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleBuy(item.id, item.cost); }}
                      className={styles.buyBtn}
                    >
                      <Lock size={14} /> {item.cost} {_t('shop.buyWithCoins')}
                    </button>
                  ) : isEquipped ? (
                    <span className={styles.equippedTag}>{_t('shop.equipped')}</span>
                  ) : (
                    <span className={styles.ownedTag}>{_t('shop.owned')}</span>
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