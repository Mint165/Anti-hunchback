import React, { useState, useEffect } from 'react';
import { loadUserStats, getBadgesStatus } from '../services/db';
import OliverPet from './OliverPet';
import PetShop from './PetShop';
import { Award, Heart, Eye, Activity, Info, X, Trophy } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import TiltCard from './ui/TiltCard';
import StatRing from './ui/StatRing';
import AnimatedCounter from './ui/AnimatedCounter';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './PetProfile.module.css';

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
      className={styles.profile}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.header}>
        <h1 className={styles.title}>{_t('pet.profileTitle')}</h1>
        <p className={styles.subtitle}>{_t('pet.profileDesc')}</p>
      </div>

      <div className={styles.grid}>
        {/* Left Column: Avatar & Progress */}
        <TiltCard className={styles.avatarCard} glowColor="var(--primary-light)">
          <motion.button
            onClick={() => setShowInfo(true)}
            className={styles.infoBtn}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Hướng dẫn thú cưng"
          >
            <Info size={24} />
          </motion.button>

          <motion.div
            className={styles.bubble}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
          >
            {_t('pet.message')}
          </motion.div>

          <div className={styles.avatarCircle}>
            <div className={styles.avatarInner}>
              <OliverPet state="good" size={260} petLevel={stats.petLevel} equippedItems={stats.equippedItems} hideBubble={true} hideBadge={true} />
            </div>
          </div>

          <h2 className={styles.petName}>Oliver</h2>
          <div className={styles.levelPill}>Level <AnimatedCounter value={stats.petLevel} duration={800} /></div>

          <div className={styles.xpWrap}>
            <div className={styles.xpHeader}>
              <span>{_t('pet.petXp')}</span>
              <span className={styles.xpValue}>{stats.petLevel >= 5 ? 'MAX' : `${stats.petXp} / ${getXpThreshold(stats.petLevel)}`}</span>
            </div>
            <div className={styles.xpTrack}>
              <motion.div
                className={styles.xpFill}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
            </div>
            <p className={styles.xpHint}>{_t('pet.keepPosture')}</p>
          </div>
        </TiltCard>

        {/* Right Column: Stats & Badges */}
        <div className={styles.rightCol}>
          {/* Health Stats */}
          <TiltCard className={styles.statsCard}>
            <h3 className={styles.cardTitle}>
              <Activity size={24} style={{ color: 'var(--primary)' }} /> {_t('pet.overallStats')}
            </h3>
            <div>
              <div className={styles.statRow}>
                <div className={styles.statLeft}>
                  <div className={styles.statIcon} style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}><Heart size={20} /></div>
                  <span className={styles.statLabel}>{_t('pet.backHealth')}</span>
                </div>
                <StatRing value={90} size={56} strokeWidth={6} gradient={{ id: 'heart-ring', from: '#ef4444', to: '#f97316' }} roundValue suffix="%" />
              </div>

              <div className={styles.statRow}>
                <div className={styles.statLeft}>
                  <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }}><Eye size={20} /></div>
                  <span className={styles.statLabel}>{_t('pet.eyeHealth')}</span>
                </div>
                <StatRing value={88} size={56} strokeWidth={6} gradient={{ id: 'eye-ring', from: '#3B82F6', to: '#06b6d4' }} roundValue suffix="%" />
              </div>

              <div className={styles.statRow}>
                <div className={styles.statLeft}>
                  <div className={styles.statIcon} style={{ background: 'var(--secondary-light)', color: 'var(--secondary)' }}><Award size={20} /></div>
                  <span className={styles.statLabel}>{_t('pet.posture')}</span>
                </div>
                <StatRing value={95} size={56} strokeWidth={6} gradient={{ id: 'posture-ring', from: '#10B981', to: '#4EAD63' }} roundValue suffix="%" />
              </div>
            </div>
          </TiltCard>

          {/* Badges */}
          <TiltCard className={styles.badgesCard}>
            <h3 className={styles.cardTitle}>
              <Trophy size={24} style={{ color: '#F59E0B' }} /> {_t('pet.myBadges')}
            </h3>
            <div className={styles.badgesGrid}>
              {badges.map((badge, i) => (
                <motion.div
                  key={badge.id}
                  className={`${styles.badge} ${badge.unlocked ? '' : styles.badgeLocked}`}
                  title={badge.description}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: badge.unlocked ? 1 : 0.4, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className={`${styles.badgeIconWrap} ${badge.unlocked ? '' : styles.badgeIconWrapLocked}`}>
                    <Award size={28} />
                  </div>
                  <span className={styles.badgeName}>{badge.name}</span>
                </motion.div>
              ))}
            </div>
          </TiltCard>
        </div>
      </div>

      <div className={styles.shopSection}>
        <PetShop />
      </div>

      <AnimatePresence>
      {showInfo && (
        <motion.div
          className={styles.modalBackdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={styles.modal}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
          >
            <motion.button
              onClick={() => setShowInfo(false)}
              className={styles.modalClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Đóng"
            >
              <X size={20} />
            </motion.button>
            <h3 className={styles.modalTitle}>Hướng dẫn Thú cưng</h3>
            <div className={styles.modalBody}>
              <div>
                <strong>Làm sao để tăng XP?</strong>
                Hãy giữ tư thế ngồi thẳng, mắt cách màn hình {'>'}50cm. Mỗi phút ngồi chuẩn bạn sẽ được cộng XP!
              </div>
              <div>
                <strong>Oliver sẽ phản ứng ra sao?</strong>
                Oliver sẽ vui vẻ (nhảy múa) khi bạn ngồi đúng. Nếu bạn cúi quá gần, Oliver sẽ nhíu mày nhắc nhở.
              </div>
              <div>
                <strong>Cách đổi vật phẩm:</strong>
                Sử dụng XP đạt được để mở khóa kính, mũ, áo ở Pet Shop bên dưới. Level càng cao, vật phẩm càng hiếm!
              </div>
            </div>
            <motion.button
              onClick={() => setShowInfo(false)}
              className={styles.modalBtn}
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