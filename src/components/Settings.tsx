// Settings Component

import React, { useState, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive';
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
  // Mobile: only the Interface section (theme + language) is shown.
  // The AI Threshold, Timers & Sound, and action buttons are desktop-
  // only per the user's mobile feature-restriction request.
  const isMobile = useMediaQuery({ maxWidth: 768 });
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
    if (window.confirm(t('settings.confirmReset'))) {
      setSettings(DEFAULT_SETTINGS);
      saveSettings(DEFAULT_SETTINGS);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm(t('settings.confirmClearHistory'))) {
      localStorage.clear();
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
              label={isDarkMode ? t('common.on') : t('common.off')}
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

        {/* AI Threshold section — desktop only. On mobile the user
            only needs theme + language; the threshold sliders would
            be unusable on a small touch screen and aren't part of the
            mobile feature set. */}
        {!isMobile && (
          <>
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
          {t('settings.timersSoundHeading')}
        </h3>

        <div className={styles.timerGrid}>
          <div className={styles.timerCell}>
            <label className={styles.timerLabel}>{t('settings.eyeExerciseCycle')}</label>
            <select
              value={settings.eyeExerciseInterval}
              onChange={(e) => handleChange('eyeExerciseInterval', parseInt(e.target.value))}
              className={styles.timerSelect}
            >
              <option value="15">{t('settings.every15Min')}</option>
              <option value="20">{t('settings.every20Min')}</option>
              <option value="30">{t('settings.every30Min')}</option>
              <option value="45">{t('settings.every45Min')}</option>
            </select>
          </div>

          <div className={styles.timerCell}>
            <label className={styles.timerLabel}>{t('settings.sessionBreakCycle')}</label>
            <select
              value={settings.sessionBreakInterval}
              onChange={(e) => handleChange('sessionBreakInterval', parseInt(e.target.value))}
              className={styles.timerSelect}
            >
              <option value="30">{t('settings.every30Min')}</option>
              <option value="45">{t('settings.every45Min')}</option>
              <option value="60">{t('settings.every60Min')}</option>
            </select>
          </div>

          {/* Sound alert (full width) */}
          <div className={styles.soundAlertRow}>
            <div className={styles.soundAlertTop}>
              <div className={styles.rowText}>
                <div className={styles.rowTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Volume2 size={20} style={{ color: 'var(--primary)' }} /> {t('settings.warningSound')}
                </div>
                <div className={styles.rowDesc}>{t('settings.warningSoundDesc')}</div>
              </div>
            </div>

            <div className={styles.soundAlertControls}>
              <select
                value={alertDelay}
                onChange={(e) => setAlertDelay(e.target.value)}
                className={styles.select}
              >
                <option value="5">{t('settings.after5Sec')}</option>
                <option value="10">{t('settings.after10Sec')}</option>
                <option value="30">{t('settings.after30Sec')}</option>
                <option value="60">{t('settings.after1Min')}</option>
                <option value="120">{t('settings.after2Min')}</option>
                <option value="300">{t('settings.after5Min')}</option>
              </select>

              <Toggle
                on={settings.soundAlertEnabled}
                onChange={(next) => handleChange('soundAlertEnabled', next)}
                label={settings.soundAlertEnabled ? t('common.on') : t('common.off')}
              />
            </div>
          </div>
        </div>

        {/* Buttons — desktop only. Mobile users have nothing to save
            here (theme + language apply instantly), and the reset /
            clear-history actions are too destructive to expose on a
            small screen where they could be tapped accidentally. */}
        <div className={styles.btnRow}>
          <button onClick={handleSave} className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSaveFull}`}>
            <Save size={18} /> {t('settings.saveBtn')}
          </button>

          <button onClick={handleReset} className={`${styles.btn} ${styles.btnSecondary}`}>
            <RefreshCw size={18} /> {t('settings.resetDefault')}
          </button>

          <button onClick={handleClearHistory} className={`${styles.btn} ${styles.btnDanger}`}>
            {t('settings.clearHistory')}
          </button>
        </div>
          </>
        )}

        <AnimatePresence>
          {isSaved && (
            <motion.div
              className={styles.savedToast}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              {t('settings.saveSuccess')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
export default Settings;