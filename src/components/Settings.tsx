// Settings Component

import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Volume2, Shield } from 'lucide-react';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../services/db';
import type { AppSettings } from '../services/db';
import { useLanguage } from '../contexts/LanguageContext';

export const Settings: React.FC = () => {
  const { lang, setLang, t } = useLanguage();
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
    <div className="min-h-full p-6 lg:p-8" style={{ background: 'var(--bg-page)' }}>
      
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
            style={{ background: '#F3F4F6', color: '#6B7280' }}>Cài đặt</span>
        </div>
        <h1 className="text-2xl font-black text-gray-800">Cấu hình Hệ thống ⚙️</h1>
        <p className="text-gray-400 text-sm font-medium mt-0.5">Điều chỉnh các ngưỡng cảnh báo và khoảng thời gian cho AI đo lường.</p>
      </div>

      <div className="premium-card max-w-2xl">
        
        {/* Theme Section */}
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6 border-b border-gray-100 dark:border-gray-700 pb-3 flex items-center gap-2">
          Giao Diện
        </h3>
        
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div>
              <div className="font-bold text-gray-800 dark:text-gray-100">Chế độ tối (Dark Mode)</div>
              <div className="text-xs text-gray-500">Giảm mỏi mắt khi học vào ban đêm</div>
            </div>
            <button 
              onClick={() => {
                const newMode = !isDarkMode;
                setIsDarkMode(newMode);
                localStorage.setItem('oliver_dark_mode', String(newMode));
                if (newMode) document.documentElement.classList.add('dark');
                else document.documentElement.classList.remove('dark');
              }}
              className={`w-14 h-7 rounded-full p-1 flex transition-colors ${isDarkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-7' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <div>
              <div className="font-bold text-gray-800 dark:text-gray-100">Ngôn ngữ / Language</div>
              <div className="text-xs text-gray-500">Thay đổi ngôn ngữ giao diện (Requires reload)</div>
            </div>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as 'vi' | 'en')}
              className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 text-sm focus:outline-none dark:text-gray-100"
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        {/* Posture Thresholds Section */}
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6 border-b border-gray-100 dark:border-gray-700 pb-3 flex items-center gap-2">
          <Shield size={20} className="text-green-600" /> Ngưỡng Đo Lường AI
        </h3>
        
        <div className="flex flex-col gap-6 mb-8">
          
          {/* Eye Distance */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-gray-700">Khoảng cách mắt tối thiểu (cm)</label>
              <span className="text-sm font-bold text-green-600">{settings.screenDistanceThreshold} cm</span>
            </div>
            <input 
              type="range" 
              min="30" 
              max="70" 
              step="5"
              value={settings.screenDistanceThreshold} 
              onChange={(e) => handleChange('screenDistanceThreshold', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
            />
            <p className="text-2xs text-gray-400 mt-1">Dưới khoảng cách này hệ thống sẽ cảnh báo mắt nhìn quá sát.</p>
          </div>

          {/* Neck Tilt */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-gray-700">Góc nghiêng cổ tối đa (Độ cúi cổ)</label>
              <span className="text-sm font-bold text-green-600">{settings.neckTiltThreshold}°</span>
            </div>
            <input 
              type="range" 
              min="10" 
              max="35" 
              step="1"
              value={settings.neckTiltThreshold} 
              onChange={(e) => handleChange('neckTiltThreshold', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
            />
            <p className="text-2xs text-gray-400 mt-1">Khi cúi đầu vượt quá góc này liên tục sẽ kích hoạt cảnh báo cúi đầu (ngoại trừ khi viết bài).</p>
          </div>

          {/* Shoulder Tilt */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-gray-700">Độ lệch vai tối đa</label>
              <span className="text-sm font-bold text-green-600">{settings.shoulderTiltThreshold}°</span>
            </div>
            <input 
              type="range" 
              min="3" 
              max="15" 
              step="1"
              value={settings.shoulderTiltThreshold} 
              onChange={(e) => handleChange('shoulderTiltThreshold', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
            />
            <p className="text-2xs text-gray-400 mt-1">Cảnh báo vẹo cột sống lệch vai khi một bên vai thấp hơn bên kia vượt mức.</p>
          </div>

          {/* Slouch threshold */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-gray-700">Độ cong lưng tối đa (Gù lưng)</label>
              <span className="text-sm font-bold text-green-600">{settings.slouchThreshold}°</span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="25" 
              step="1"
              value={settings.slouchThreshold} 
              onChange={(e) => handleChange('slouchThreshold', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
            />
            <p className="text-2xs text-gray-400 mt-1">Góc đo co rút gù lưng so với lúc hiệu chuẩn.</p>
          </div>

        </div>

        {/* Timers Settings */}
        <h3 className="text-lg font-bold text-gray-800 mb-6 border-b border-gray-100 pb-3 flex items-center gap-2">
          <Volume2 size={20} className="text-green-600" /> Chu kỳ Cảnh báo & Âm thanh
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Chu kỳ Bài tập Mắt (phút)</label>
            <select 
              value={settings.eyeExerciseInterval} 
              onChange={(e) => handleChange('eyeExerciseInterval', parseInt(e.target.value))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
            >
              <option value="15">Mỗi 15 phút</option>
              <option value="20">Mỗi 20 phút (Khuyên dùng)</option>
              <option value="30">Mỗi 30 phút</option>
              <option value="45">Mỗi 45 phút</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Thời gian Khóa vận động (phút)</label>
            <select 
              value={settings.sessionBreakInterval} 
              onChange={(e) => handleChange('sessionBreakInterval', parseInt(e.target.value))}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
            >
              <option value="30">Mỗi 30 phút</option>
              <option value="45">Mỗi 45 phút (Khuyên dùng)</option>
              <option value="60">Mỗi 60 phút</option>
            </select>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between md:col-span-2 p-3.5 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 gap-4">
            <div>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 block">Kích hoạt âm thanh cảnh báo</span>
              <span className="text-2xs text-gray-400">Phát chuỗi âm thanh bíp khi trẻ ngồi sai tư thế liên tục vượt thời gian cho phép.</span>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
              <select 
                value={alertDelay} 
                onChange={(e) => setAlertDelay(e.target.value)}
                className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 dark:text-white"
              >
                <option value="5">Sau 5 giây (Test)</option>
                <option value="10">Sau 10 giây</option>
                <option value="30">Sau 30 giây</option>
                <option value="60">Sau 1 phút</option>
                <option value="120">Sau 2 phút (Mặc định)</option>
                <option value="300">Sau 5 phút</option>
              </select>
              
              <input 
                type="checkbox" 
                checked={settings.soundAlertEnabled}
                onChange={(e) => handleChange('soundAlertEnabled', e.target.checked)}
                className="w-5 h-5 rounded text-green-600 accent-green-600 focus:ring-green-500"
              />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 border-t border-gray-100 pt-6">
          <button
            onClick={handleSave}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-2xl shadow-sm hover:shadow-md transition-all"
          >
            <Save size={18} /> Lưu Cài Đặt
          </button>
          
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-2xl transition-all"
          >
            <RefreshCw size={16} /> Khôi phục mặc định
          </button>

          <button
            onClick={handleClearHistory}
            className="w-full sm:w-auto sm:ml-auto px-4 py-3 text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-2xl transition-all"
          >
            Xóa lịch sử hệ thống
          </button>
        </div>

        {isSaved && (
          <div className="mt-4 p-3.5 bg-green-50 text-green-700 border border-green-200 rounded-2xl text-center text-xs font-semibold animate-pulse">
            Đã lưu thay đổi thành công!
          </div>
        )}

      </div>

    </div>
  );
};
export default Settings;
