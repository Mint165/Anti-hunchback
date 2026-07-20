// Settings Component

import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Volume2, Shield, Globe, Clock } from 'lucide-react';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../services/db';
import type { AppSettings } from '../services/db';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Settings.module.css';

const Toggle: React.FC<{
  on: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}> = ({ on, onChange, label }) => (
  <div className="flex items-center">
    <button
      onClick={() => onChange(!on)}
      className={`${styles.toggle} ${on ? styles.toggleOn : ''}`}
      role="switch"
      aria-checked={on}
    >
      <motion.div
        className={styles.toggleKnob}
        animate={{ x: on ? 28 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
    {label && (
      <span className={`${styles.toggleStateLabel} ${on ? styles.toggleStateOn : styles.toggleStateOff}`}>
        {label}
      </span>
    )}
  </div>
);

export const Settings: React.FC = () => {
  const { t, lang, setLang } = useLanguage();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [alertDelay, setAlertDelay] = useState<string>(() => localStorage.getItem('oliver_alert_delay') || '120');

  useEffect(() => {
    setSettings(loadSettings());
    const darkTheme = localStorage.getItem('oliver_dark_mode') === 'true';
    setIsDarkMode(darkTheme);
    if (darkTheme) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const handleChange = (key: keyof AppSettings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setIsSaved(false);
  };

  const handleSave = () => {
    saveSettings(settings);
    localStorage.setItem('oliver_alert_delay', alertDelay);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleReset = () => {
    if (window.confirm('Bạn có muốn khôi phục cài đặt mặc định không?')) {
      setSettings(DEFAULT_SETTINGS);
      saveSettings(DEFAULT_SETTINGS);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('CẢNH BÁO: Hành động này sẽ xóa toàn bộ lịch sử buổi học và điểm kinh nghiệm XP. Bạn có chắc chắn muốn thực hiện?')) {
      localStorage.clear();
      alert('Đã xóa toàn bộ lịch sử. Trang web sẽ tải lại.');
      alert(t('settings.clearSuccess'));
      window.location.reload();
    }
  };

  return (
    <motion.div
      className={styles.settings}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.header}>
        <span className={styles.tag}>{t('settings.title')}</span>
        <h1 className={styles.title}>{t('settings.header')}</h1>
        <p className={styles.subtitle}>{t('settings.subheader')}</p>
      </div>

      <div className={styles.card}>

        {/* Interface section */}
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}><Globe size={20} /></span>
          {t('settings.interface')}
        </h3>

        <div className={styles.sectionRows}>
          {/* Dark mode */}
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>{t('settings.darkMode')}</div>
              <div className={styles.rowDesc}>{t('settings.darkModeDesc')}</div>
            </div>
            <Toggle
              on={isDarkMode}
              onChange={(next) => {
                setIsDarkMode(next);
                localStorage.setItem('oliver_dark_mode', String(next));
                if (next) document.documentElement.classList.add('dark');
                else document.documentElement.classList.remove('dark');
              }}
              label={isDarkMode ? 'Bật' : 'Tắt'}
            />
          </div>

          {/* Language */}
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>{t('settings.language')}</div>
              <div className={styles.rowDesc}>{t('settings.languageDesc')}</div>
            </div>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as 'vi' | 'en')}
              className={styles.select}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        {/* AI Threshold section */}
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}><Shield size={20} /></span>
          {t('settings.aiThreshold')}
        </h3>

        <div className={styles.sectionRows}>
          {/* Eye distance */}
          <div className={styles.sliderRow}>
            <div className={styles.sliderHeader}>
              <label className={styles.sliderLabel}>{t('settings.eyeDistance')}</label>
              <span className={styles.sliderValue}>{settings.screenDistanceThreshold} cm</span>
            </div>
            <input
              type="range"
              min="30" max="70" step="5"
              value={settings.screenDistanceThreshold}
              onChange={(e) => handleChange('screenDistanceThreshold', parseInt(e.target.value))}
              className={styles.slider}
            />
            <p className={styles.sliderDesc}>{t('settings.eyeDistanceDesc')}</p>
          </div>

          {/* Neck tilt */}
          <div className={styles.sliderRow}>
            <div className={styles.sliderHeader}>
              <label className={styles.sliderLabel}>{t('settings.neckTilt')}</label>
              <span className={styles.sliderValue}>{settings.neckTiltThreshold}°</span>
            </div>
            <input
              type="range"
              min="10" max="35" step="1"
              value={settings.neckTiltThreshold}
              onChange={(e) => handleChange('neckTiltThreshold', parseInt(e.target.value))}
              className={styles.slider}
            />
          </div>

          {/* Shoulder tilt */}
          <div className={styles.sliderRow}>
            <div className={styles.sliderHeader}>
              <label className={styles.sliderLabel}>{t('settings.shoulderTilt')}</label>
              <span className={styles.sliderValue}>{settings.shoulderTiltThreshold}°</span>
            </div>
            <input
              type="range"
              min="3" max="15" step="1"
              value={settings.shoulderTiltThreshold}
              onChange={(e) => handleChange('shoulderTiltThreshold', parseInt(e.target.value))}
              className={styles.slider}
            />
          </div>

          {/* Slouch */}
          <div className={styles.sliderRow}>
            <div className={styles.sliderHeader}>
              <label className={styles.sliderLabel}>{t('settings.slouch')}</label>
              <span className={styles.sliderValue}>{settings.slouchThreshold}°</span>
            </div>
            <input
              type="range"
              min="5" max="25" step="1"
              value={settings.slouchThreshold}
              onChange={(e) => handleChange('slouchThreshold', parseInt(e.target.value))}
              className={styles.slider}
            />
          </div>
        </div>

        {/* Timers & Sound section */}
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}><Clock size={20} /></span>
          Chu kỳ Cảnh báo & Âm thanh
        </h3>

        <div className={styles.timerGrid}>
          <div className={styles.timerCell}>
            <label className={styles.timerLabel}>Chu kỳ Bài tập Mắt</label>
            <select
              value={settings.eyeExerciseInterval}
              onChange={(e) => handleChange('eyeExerciseInterval', parseInt(e.target.value))}
              className={styles.timerSelect}
            >
              <option value="15">Mỗi 15 phút</option>
              <option value="20">Mỗi 20 phút (Khuyên dùng)</option>
              <option value="30">Mỗi 30 phút</option>
              <option value="45">Mỗi 45 phút</option>
            </select>
          </div>

          <div className={styles.timerCell}>
            <label className={styles.timerLabel}>Thời gian Khóa vận động</label>
            <select
              value={settings.sessionBreakInterval}
              onChange={(e) => handleChange('sessionBreakInterval', parseInt(e.target.value))}
              className={styles.timerSelect}
            >
              <option value="30">Mỗi 30 phút</option>
              <option value="45">Mỗi 45 phút (Khuyên dùng)</option>
              <option value="60">Mỗi 60 phút</option>
            </select>
          </div>

          {/* Sound alert (full width) */}
          <div className={styles.soundAlertRow}>
            <div className={styles.soundAlertTop}>
              <div className={styles.rowText}>
                <div className={styles.rowTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Volume2 size={20} style={{ color: 'var(--primary)' }} /> Âm thanh cảnh báo
                </div>
                <div className={styles.rowDesc}>Phát chuỗi âm thanh bíp khi ngồi sai. Độ trễ có thể tùy chỉnh để tránh bị làm phiền.</div>
              </div>
            </div>

            <div className={styles.soundAlertControls}>
              <select
                value={alertDelay}
                onChange={(e) => setAlertDelay(e.target.value)}
                className={styles.select}
              >
                <option value="5">Sau 5 giây (Test)</option>
                <option value="10">Sau 10 giây</option>
                <option value="30">Sau 30 giây</option>
                <option value="60">Sau 1 phút</option>
                <option value="120">Sau 2 phút (Mặc định)</option>
                <option value="300">Sau 5 phút</option>
              </select>

              <Toggle
                on={settings.soundAlertEnabled}
                onChange={(next) => handleChange('soundAlertEnabled', next)}
                label={settings.soundAlertEnabled ? 'Bật' : 'Tắt'}
              />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className={styles.btnRow}>
          <button onClick={handleSave} className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSaveFull}`}>
            <Save size={18} /> Lưu Cài Đặt
          </button>

          <button onClick={handleReset} className={`${styles.btn} ${styles.btnSecondary}`}>
            <RefreshCw size={18} /> Khôi phục mặc định
          </button>

          <button onClick={handleClearHistory} className={`${styles.btn} ${styles.btnDanger}`}>
            Xóa lịch sử
          </button>
        </div>

        <AnimatePresence>
          {isSaved && (
            <motion.div
              className={styles.savedToast}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              Đã lưu thay đổi thành công! 🎉
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
export default Settings;