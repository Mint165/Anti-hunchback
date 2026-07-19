// Settings Component

import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Volume2, Shield } from 'lucide-react';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../services/db';
import type { AppSettings } from '../services/db';
import { useLanguage } from '../contexts/LanguageContext';
import TiltCard from './ui/TiltCard';
import { motion, AnimatePresence } from 'framer-motion';

export const Settings: React.FC = () => {
  const { lang, setLang } = useLanguage();
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
      window.location.reload();
    }
  };

  return (
    <motion.div 
      className="min-h-full p-4 md:p-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      
      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>Cài đặt</span>
        </div>
        <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--text-main)' }}>Cấu hình Hệ thống ⚙️</h1>
        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Điều chỉnh các ngưỡng cảnh báo và khoảng thời gian cho AI đo lường.</p>
      </div>

      <TiltCard className="max-w-2xl p-6 md:p-8" glowColor="var(--primary-light)">
        
        {/* Theme Section */}
        <h3 className="text-xl font-black mb-6 border-b pb-4 flex items-center gap-3" style={{ color: 'var(--text-main)', borderColor: 'rgba(124,58,237,0.1)' }}>
          Giao Diện
        </h3>
        
        <div className="flex flex-col gap-5 mb-10">
          <div className="flex items-center justify-between p-5 rounded-2xl" style={{ background: 'var(--bg-page)', border: '2px solid rgba(124,58,237,0.1)' }}>
            <div>
              <div className="font-bold text-lg" style={{ color: 'var(--text-main)' }}>Chế độ tối (Dark Mode)</div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Giảm mỏi mắt khi học vào ban đêm</div>
            </div>
            <button 
              onClick={() => {
                const newMode = !isDarkMode;
                setIsDarkMode(newMode);
                localStorage.setItem('oliver_dark_mode', String(newMode));
                if (newMode) document.documentElement.classList.add('dark');
                else document.documentElement.classList.remove('dark');
              }}
              className="relative w-16 h-8 rounded-full transition-colors duration-300 shadow-inner"
              style={{ background: isDarkMode ? 'var(--primary)' : 'var(--text-muted)' }}
            >
              <motion.div 
                className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md"
                animate={{ x: isDarkMode ? 32 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-5 rounded-2xl" style={{ background: 'var(--bg-page)', border: '2px solid rgba(124,58,237,0.1)' }}>
            <div>
              <div className="font-bold text-lg" style={{ color: 'var(--text-main)' }}>Ngôn ngữ / Language</div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Thay đổi ngôn ngữ giao diện</div>
            </div>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as 'vi' | 'en')}
              className="px-4 py-2 text-sm font-bold rounded-xl focus:outline-none appearance-none cursor-pointer text-center"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: '2px solid rgba(16,185,129,0.2)' }}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        {/* Posture Thresholds Section */}
        <h3 className="text-xl font-black mb-6 border-b pb-4 flex items-center gap-3" style={{ color: 'var(--text-main)', borderColor: 'rgba(124,58,237,0.1)' }}>
          <Shield size={24} style={{ color: 'var(--primary)' }} /> Ngưỡng Đo Lường AI
        </h3>
        
        <div className="flex flex-col gap-6 mb-10">
          
          {/* Eye Distance */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Khoảng cách mắt (cm)</label>
              <span className="text-sm font-black px-3 py-1 rounded-xl" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{settings.screenDistanceThreshold} cm</span>
            </div>
            <input 
              type="range" min="30" max="70" step="5"
              value={settings.screenDistanceThreshold} 
              onChange={(e) => handleChange('screenDistanceThreshold', parseInt(e.target.value))}
              className="w-full h-3 rounded-full appearance-none cursor-pointer bg-gray-200 accent-emerald-500"
            />
            <p className="text-xs font-medium mt-2" style={{ color: 'var(--text-muted)' }}>Dưới khoảng cách này hệ thống sẽ cảnh báo mắt nhìn quá sát.</p>
          </div>

          {/* Neck Tilt */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Góc nghiêng cổ (Độ)</label>
              <span className="text-sm font-black px-3 py-1 rounded-xl" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{settings.neckTiltThreshold}°</span>
            </div>
            <input 
              type="range" min="10" max="35" step="1"
              value={settings.neckTiltThreshold} 
              onChange={(e) => handleChange('neckTiltThreshold', parseInt(e.target.value))}
              className="w-full h-3 rounded-full appearance-none cursor-pointer bg-gray-200 accent-emerald-500"
            />
          </div>

          {/* Shoulder Tilt */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Độ lệch vai (Độ)</label>
              <span className="text-sm font-black px-3 py-1 rounded-xl" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{settings.shoulderTiltThreshold}°</span>
            </div>
            <input 
              type="range" min="3" max="15" step="1"
              value={settings.shoulderTiltThreshold} 
              onChange={(e) => handleChange('shoulderTiltThreshold', parseInt(e.target.value))}
              className="w-full h-3 rounded-full appearance-none cursor-pointer bg-gray-200 accent-emerald-500"
            />
          </div>

          {/* Slouch threshold */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Độ cong lưng (Độ)</label>
              <span className="text-sm font-black px-3 py-1 rounded-xl" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{settings.slouchThreshold}°</span>
            </div>
            <input 
              type="range" min="5" max="25" step="1"
              value={settings.slouchThreshold} 
              onChange={(e) => handleChange('slouchThreshold', parseInt(e.target.value))}
              className="w-full h-3 rounded-full appearance-none cursor-pointer bg-gray-200 accent-emerald-500"
            />
          </div>

        </div>

        {/* Timers Settings */}
        <h3 className="text-xl font-black mb-6 border-b pb-4 flex items-center gap-3" style={{ color: 'var(--text-main)', borderColor: 'rgba(124,58,237,0.1)' }}>
          <Volume2 size={24} style={{ color: 'var(--primary)' }} /> Chu kỳ Cảnh báo & Âm thanh
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div>
            <label className="text-sm font-bold uppercase tracking-wider block mb-3" style={{ color: 'var(--text-secondary)' }}>Chu kỳ Bài tập Mắt</label>
            <select 
              value={settings.eyeExerciseInterval} 
              onChange={(e) => handleChange('eyeExerciseInterval', parseInt(e.target.value))}
              className="w-full px-4 py-3 text-sm font-bold rounded-xl focus:outline-none appearance-none cursor-pointer"
              style={{ background: 'var(--bg-page)', color: 'var(--text-main)', border: '2px solid rgba(124,58,237,0.1)' }}
            >
              <option value="15">Mỗi 15 phút</option>
              <option value="20">Mỗi 20 phút (Khuyên dùng)</option>
              <option value="30">Mỗi 30 phút</option>
              <option value="45">Mỗi 45 phút</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-bold uppercase tracking-wider block mb-3" style={{ color: 'var(--text-secondary)' }}>Thời gian Khóa vận động</label>
            <select 
              value={settings.sessionBreakInterval} 
              onChange={(e) => handleChange('sessionBreakInterval', parseInt(e.target.value))}
              className="w-full px-4 py-3 text-sm font-bold rounded-xl focus:outline-none appearance-none cursor-pointer"
              style={{ background: 'var(--bg-page)', color: 'var(--text-main)', border: '2px solid rgba(124,58,237,0.1)' }}
            >
              <option value="30">Mỗi 30 phút</option>
              <option value="45">Mỗi 45 phút (Khuyên dùng)</option>
              <option value="60">Mỗi 60 phút</option>
            </select>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between md:col-span-2 p-5 rounded-2xl gap-4" style={{ background: 'var(--bg-page)', border: '2px solid rgba(124,58,237,0.1)' }}>
            <div>
              <span className="text-lg font-bold block" style={{ color: 'var(--text-main)' }}>Âm thanh cảnh báo</span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Phát chuỗi âm thanh bíp khi ngồi sai</span>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
              <select 
                value={alertDelay} 
                onChange={(e) => setAlertDelay(e.target.value)}
                className="px-4 py-2 text-sm font-bold rounded-xl focus:outline-none appearance-none cursor-pointer text-center"
                style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: '2px solid rgba(16,185,129,0.2)' }}
              >
                <option value="5">Sau 5 giây (Test)</option>
                <option value="10">Sau 10 giây</option>
                <option value="30">Sau 30 giây</option>
                <option value="60">Sau 1 phút</option>
                <option value="120">Sau 2 phút (Mặc định)</option>
                <option value="300">Sau 5 phút</option>
              </select>
              
              <button 
                onClick={() => handleChange('soundAlertEnabled', !settings.soundAlertEnabled)}
                className="relative w-14 h-7 rounded-full transition-colors duration-300 shadow-inner"
                style={{ background: settings.soundAlertEnabled ? 'var(--primary)' : 'var(--text-muted)' }}
              >
                <motion.div 
                  className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md"
                  animate={{ x: settings.soundAlertEnabled ? 28 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 border-t pt-8" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
          <button
            onClick={handleSave}
            className="btn-3d btn-3d-primary w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-8 text-sm"
          >
            <Save size={18} /> Lưu Cài Đặt
          </button>
          
          <button
            onClick={handleReset}
            className="btn-3d btn-3d-secondary w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-6 text-sm"
          >
            <RefreshCw size={18} /> Khôi phục mặc định
          </button>

          <button
            onClick={handleClearHistory}
            className="btn-3d w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-2 py-3 px-6 text-sm"
            style={{ background: 'var(--danger)', color: 'white', borderBottomColor: '#b91c1c' }}
          >
            Xóa lịch sử
          </button>
        </div>

        <AnimatePresence>
          {isSaved && (
            <motion.div 
              className="mt-6 p-4 rounded-2xl text-center text-sm font-black"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: '2px solid rgba(16,185,129,0.2)' }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              Đã lưu thay đổi thành công! 🎉
            </motion.div>
          )}
        </AnimatePresence>

      </TiltCard>

    </motion.div>
  );
};
export default Settings;
