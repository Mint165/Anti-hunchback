// Notifications — parent-side feed for camera-off / fatigue / camera-on alerts.
// Reads persisted notifications from localStorage (so offline parents still
// see what happened) and merges in realtime events via subscribeToStudentSync.
// All colors come from tokens.css so the feed auto-adapts to data-theme and
// .dark per the project constitution.
import React, { useEffect, useState, useMemo } from 'react';
import { Bell, CameraOff, Camera, AlertTriangle, CheckCheck, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import {
  loadNotifications,
  markAllNotificationsRead,
  clearNotifications,
  subscribeToStudentSync,
  type ParentNotification,
} from '../services/parentSync';
import { getUserIdSync } from '../services/db';
import styles from './Notifications.module.css';

const formatRelativeTime = (ts: number, t: (k: string) => string): string => {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return t('notifications.justNow');
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} ${t('notifications.minuteAgo')}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${t('notifications.hourAgo')}`;
  const day = Math.floor(hr / 24);
  return `${day} ${t('notifications.dayAgo')}`;
};

const iconFor = (kind: ParentNotification['kind']) => {
  if (kind === 'camera_off') return CameraOff;
  if (kind === 'camera_on') return Camera;
  return AlertTriangle; // fatigue
};

const iconWrapClassFor = (kind: ParentNotification['kind']) => {
  if (kind === 'camera_off') return styles.iconWrapCameraOff;
  if (kind === 'camera_on') return styles.iconWrapCameraOn;
  return styles.iconWrapFatigue;
};

export const Notifications: React.FC = () => {
  const { t } = useLanguage();
  const [items, setItems] = useState<ParentNotification[]>(() => loadNotifications());
  const [isLive, setIsLive] = useState<boolean>(false);

  // Subscribe to realtime camera + fatigue alerts so the feed updates
  // immediately when the student toggles their camera, even before the
  // parent reloads. status_update is also wired (required by the API) but
  // we don't render posture status here — that lives on the parent dashboard.
  useEffect(() => {
    setIsLive(true);
    const unsubscribe = subscribeToStudentSync(
      () => {},
      (_msg, ts) => {
        // A fatigue alert already persisted a notification via
        // broadcastFatigueAlert; just refresh from storage so we pick up
        // the new entry + dedupe.
        setItems(loadNotifications());
        void ts;
      },
      (_action, _msg, ts) => {
        setItems(loadNotifications());
        void ts;
      },
      getUserIdSync()
    );
    return () => {
      unsubscribe();
      setIsLive(false);
    };
  }, []);

  // Re-sort + recompute read/unread counts whenever items change.
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.timestamp - a.timestamp),
    [items]
  );
  const unreadCount = useMemo(
    () => items.filter((n) => !n.read).length,
    [items]
  );

  const handleMarkAllRead = () => {
    setItems(markAllNotificationsRead());
  };

  const handleClear = () => {
    clearNotifications();
    setItems([]);
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1>{t('notifications.title')}</h1>
          <p>{t('notifications.emptyDesc')}</p>
        </div>
        <div className={styles.actions}>
          {isLive && (
            <span className={styles.livePill}>
              <span className={styles.liveDot} />
              {t('student.live')}
            </span>
          )}
          <button
            type="button"
            className={styles.btn}
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={16} />
            {t('notifications.markAllRead')}
            {unreadCount > 0 && (
              <span style={{ opacity: 0.7 }}> ({unreadCount})</span>
            )}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={handleClear}
            disabled={items.length === 0}
          >
            <Trash2 size={16} />
            {t('notifications.clear')}
          </button>
        </div>
      </header>

      {sortedItems.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <Bell size={32} />
          </div>
          <p className={styles.emptyTitle}>{t('notifications.empty')}</p>
          <p className={styles.emptyDesc}>{t('notifications.emptyDesc')}</p>
        </div>
      ) : (
        <ul className={styles.list}>
          <AnimatePresence initial={false}>
            {sortedItems.map((n) => {
              const Icon = iconFor(n.kind);
              const wrapClass = iconWrapClassFor(n.kind);
              const titleKey =
                n.kind === 'camera_off'
                  ? 'notifications.cameraOff'
                  : n.kind === 'camera_on'
                  ? 'notifications.cameraOn'
                  : 'notifications.fatigueAlert';
              return (
                <motion.li
                  key={n.id}
                  className={`${styles.item} ${!n.read ? styles.itemUnread : ''}`}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                >
                  <div className={`${styles.iconWrap} ${wrapClass}`}>
                    <Icon size={20} />
                  </div>
                  <div className={styles.body}>
                    <p className={styles.title}>
                      {t(titleKey)}
                      {!n.read && <span className={styles.unreadDot} aria-label={t('notifications.unreadBadge')} />}
                    </p>
                    <p className={styles.message}>{n.message}</p>
                    <span className={styles.timestamp}>
                      {formatRelativeTime(n.timestamp, t)}
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
};

export default Notifications;
