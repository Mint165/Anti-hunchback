import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import type { AuthUser } from './AuthScreen';
import { X, Save, LogOut } from 'lucide-react';

interface UserProfileProps {
  user: AuthUser;
  onClose: () => void;
  onLogout: () => void;
  onUpdateParentCode: (code: string) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onClose, onLogout, onUpdateParentCode }) => {
  const { t } = useLanguage();
  const [parentCode, setParentCode] = useState(user.parentLinkedCode || '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onUpdateParentCode(parentCode);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 h-full shadow-2xl flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t('profile.title')}</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full transition-colors">
            <X size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-primary to-purple-600 text-white rounded-full flex items-center justify-center text-4xl font-black shadow-lg mb-4">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-2xl font-black text-gray-800 dark:text-white">{user.name}</h3>
            <div className="pill-tag pill-primary mt-2">
              {user.role === 'student' ? t('profile.roleStudent') : t('profile.roleParent')}
            </div>
          </div>

          <div className="space-y-6">
            {user.role === 'student' && user.linkedCode && (
              <div className="bg-primary-light dark:bg-slate-700 p-5 rounded-2xl border border-primary/20">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{t('profile.linkCodeDesc')}</p>
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{t('profile.linkCodeLabel')}</div>
                <div className="text-3xl font-black text-primary text-center tracking-[0.2em] py-2 bg-white dark:bg-slate-800 rounded-xl">
                  {user.linkedCode}
                </div>
              </div>
            )}

            {user.role === 'parent' && (
              <div className="bg-gray-50 dark:bg-slate-700/50 p-5 rounded-2xl border border-gray-100 dark:border-slate-700">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{t('profile.parentLinkDesc')}</p>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">{t('profile.parentLinkLabel')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={parentCode}
                    onChange={(e) => setParentCode(e.target.value)}
                    className="flex-1 p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary text-center font-bold tracking-[0.1em]"
                    placeholder="123456"
                    maxLength={6}
                  />
                  <button onClick={handleSave} className="bg-primary text-white p-3 rounded-xl hover:bg-primary-hover transition-colors flex items-center justify-center shadow-btn">
                    <Save size={20} />
                  </button>
                </div>
                {saved && <p className="text-green-500 text-sm mt-2 text-center font-medium">{t('profile.saved')}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-slate-700">
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-4 text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl font-bold transition-colors">
            <LogOut size={20} />
            {t('profile.logout')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
