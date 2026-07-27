import React, { useState, useEffect, useMemo } from 'react';
import { useMediaQuery } from 'react-responsive';
import { loadUserStats, getBadgesStatus, getSessionRecords } from '../services/db';
import type { SessionRecord } from '../services/db';
import OliverPet from './OliverPet';
import PetShop from './PetShop';
import { Award, Heart, Eye, Activity, Info, X, Trophy } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import TiltCard from './ui/TiltCard';
import StatRing from './ui/StatRing';
import AnimatedCounter from './ui/AnimatedCounter';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './PetProfile.module.css';

/**
 * Compute the three "Overall Stats" rings from the user's recent
 * study sessions (last 7 days). Previously these were hardcoded to
 * 90 / 88 / 95 in the JSX, so they never changed across accounts or
 * sessions — making the panel look frozen.
 *
 * The values returned are 0–100 scores:
 *  - posture    = average `goodPosturePercentage` across the 7-day
 *                 sessions (already a 0–100 score from the session
 *                 record).
 *  - backHealth = 100 − clamp(avg(slouchAngle) + avg(shoulderTilt), 0, 100).
 *                 Straighter back → smaller angles → higher score.
 *  - eyeHealth  = average `averageHealthScore` across the 7-day
 *                 sessions (the per-session PHI score, 0–100).
 *
 * If there are no recent sessions, all three return 0 and the caller
 * shows a "no data" hint so the user understands why the rings are
 * empty rather than thinking the panel is broken.
 */
function computeOverallStats(sessions: SessionRecord[]): {
  backHealth: number;
  eyeHealth: number;
  posture: number;
  hasData: boolean;
} {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = sessions.filter((s) => s.startTime >= sevenDaysAgo);
  if (recent.length === 0) {
    return { backHealth: 0, eyeHealth: 0, posture: 0, hasData: false };
  }
  const avg = (sel: (s: SessionRecord) => number | undefined) => {
    let sum = 0;
    let n = 0;
    for (const s of recent) {
      const v = sel(s);
      if (typeof v === 'number' && !Number.isNaN(v)) {
        sum += v;
        n += 1;
      }
    }
    return n > 0 ? sum / n : 0;
  };
  const posture = Math.round(avg((s) => s.goodPosturePercentage));
  const eyeHealth = Math.round(avg((s) => s.averageHealthScore));
  // Slouch + shoulder tilt are angles in degrees; smaller = straighter.
  // Map the sum (0..~100°) onto a 100..0 inverted scale.
  const slouchAvg = avg((s) => s.averageSlouchAngle);
  const shoulderAvg = avg((s) => s.averageShoulderTilt);
  const anglePenalty = Math.max(0, Math.min(100, slouchAvg + shoulderAvg));
  const backHealth = Math.round(100 - anglePenalty);
  return { backHealth, eyeHealth, posture, hasData: true };
}

export const PetProfile: React.FC = () => {
  const { t: _t } = useLanguage();
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const [stats, setStats] = useState(() => loadUserStats());
  const [badges, setBadges] = useState(() => getBadgesStatus());
  const [sessions, setSessions] = useState<SessionRecord[]>(() => getSessionRecords());
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    // Only load once when mounted, and listen to visibility change (same fix as FloatingPet)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setStats(loadUserStats());
        setBadges(getBadgesStatus());
        setSessions(getSessionRecords());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Refresh the overall-stats rings every 10 s so a freshly-ended
  // session shows up without a page reload. The user explicitly asked
  // for the "real-time" portion here NOT to run continuously, only at
  // a 10 s cadence — so we poll `getSessionRecords()` rather than
  // subscribing to the live MediaPipe metrics (PetProfile has no
  // camera of its own anyway).
  useEffect(() => {
    const id = window.setInterval(() => {
      setSessions(getSessionRecords());
      setStats(loadUserStats());
    }, 10000);
    return () => window.clearInterval(id);
  }, []);

  const overallStats = useMemo(() => computeOverallStats(sessions), [sessions]);

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
          {/* Hide the info button on mobile — the info modal is also
              hidden on mobile (see AnimatePresence below), so the
              button would be a dead affordance. */}
          {!isMobile && (
            <motion.button
              onClick={() => setShowInfo(true)}
              className={styles.infoBtn}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Hướng dẫn thú cưng"
            >
              <Info size={24} />
            </motion.button>
          )}

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
              <OliverPet state="good" size={208} petLevel={stats.petLevel} equippedItems={stats.equippedItems} hideBubble={true} hideBadge={true} lowDetail />
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
            {!overallStats.hasData && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px 0', fontStyle: 'italic' }}>
                {_t('pet.noData')}
              </p>
            )}
            <div>
              <div className={styles.statRow}>
                <div className={styles.statLeft}>
                  <div className={styles.statIcon} style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}><Heart size={20} /></div>
                  <span className={styles.statLabel}>{_t('pet.backHealth')}</span>
                </div>
                <StatRing value={overallStats.backHealth} size={56} strokeWidth={6} gradient={{ id: 'heart-ring', from: '#ef4444', to: '#f97316' }} roundValue suffix="%" />
              </div>

              <div className={styles.statRow}>
                <div className={styles.statLeft}>
                  <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }}><Eye size={20} /></div>
                  <span className={styles.statLabel}>{_t('pet.eyeHealth')}</span>
                </div>
                <StatRing value={overallStats.eyeHealth} size={56} strokeWidth={6} gradient={{ id: 'eye-ring', from: '#3B82F6', to: '#06b6d4' }} roundValue suffix="%" />
              </div>

              <div className={styles.statRow}>
                <div className={styles.statLeft}>
                  <div className={styles.statIcon} style={{ background: 'var(--secondary-light)', color: 'var(--secondary)' }}><Award size={20} /></div>
                  <span className={styles.statLabel}>{_t('pet.posture')}</span>
                </div>
                <StatRing value={overallStats.posture} size={56} strokeWidth={6} gradient={{ id: 'posture-ring', from: '#10B981', to: '#4EAD63' }} roundValue suffix="%" />
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

      {/* Pet Shop is desktop-only on mobile per the user's feature
          restriction request — the mobile Pet tab keeps only the
          Oliver profile, overall stats, and badges. */}
      {!isMobile && (
        <div className={styles.shopSection}>
          <PetShop />
        </div>
      )}

      {/* Info modal — desktop only (button is also hidden on mobile
          above, so this never opens on mobile anyway, but we also
          gate the modal here for safety). */}
      <AnimatePresence>
      {showInfo && !isMobile && (
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
