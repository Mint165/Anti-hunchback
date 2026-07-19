import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import type { AuthUser } from './AuthScreen';
import { X, Save, LogOut, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import TiltCard from './ui/TiltCard';

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
    <motion.div 
      className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div 
        className="w-full max-w-md h-full overflow-y-auto relative p-6 shadow-2xl"
        style={{ background: 'var(--bg-page)', borderLeft: '1px solid var(--border-color)' }}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <X size={24} style={{ color: 'var(--text-main)' }} />
        </button>

        <h2 className="text-3xl font-black mb-8" style={{ color: 'var(--text-main)' }}>{t('profile.title')}</h2>

        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black shadow-lg mb-4" style={{ background: 'var(--primary)', color: 'white' }}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <h3 className="text-2xl font-black mb-1" style={{ color: 'var(--text-main)' }}>{user.name}</h3>
          <div className="px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest mt-2" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            {user.role === 'student' ? t('profile.roleStudent') : t('profile.roleParent')}
          </div>
        </div>

        {user.role === 'student' && (
          <TiltCard className="p-6 mb-6">
            <h3 className="text-lg font-black mb-4" style={{ color: 'var(--text-main)' }}>{t('profile.stats')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div className="text-sm font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>{t('profile.totalSessions')}</div>
                <div className="text-2xl font-black" style={{ color: 'var(--primary)' }}>12</div>
              </div>
              <div className="p-4 rounded-xl text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div className="text-sm font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>{t('profile.bestStreak')}</div>
                <div className="text-2xl font-black text-orange-500">5 🔥</div>
              </div>
            </div>
          </TiltCard>
        )}

        <div className="space-y-4 mb-8">
          {user.role === 'parent' && (
            <div className="p-6 rounded-2xl border" style={{ background: 'var(--primary-light)', borderColor: 'rgba(124, 58, 237, 0.2)' }}>
              <div className="flex items-center gap-3 mb-3">
                <LinkIcon size={20} style={{ color: 'var(--primary)' }} />
                <h3 className="font-black text-lg" style={{ color: 'var(--primary)' }}>{t('profile.linkedParent')}</h3>
              </div>
              <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-secondary)' }}>{t('profile.parentLinkLabel')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={parentCode}
                  onChange={(e) => setParentCode(e.target.value)}
                  className="flex-1 p-3 rounded-xl border focus:outline-none focus:ring-2 text-center font-black tracking-[0.2em] text-lg"
                  style={{ background: 'var(--bg-page)', borderColor: 'rgba(124,58,237,0.2)', color: 'var(--text-main)' }}
                  placeholder="123456"
                  maxLength={6}
                />
                <button onClick={handleSave} className="btn-3d btn-3d-primary px-4 py-3 flex items-center justify-center">
                  <Save size={20} />
                </button>
              </div>
              {saved && <p className="text-sm mt-3 text-center font-black" style={{ color: 'var(--primary)' }}>{t('profile.saved')} 🎉</p>}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-auto pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <button onClick={() => setParentCode('')} className="btn-3d btn-3d-secondary w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-6 text-sm">
            <RefreshCw size={18} /> {t('profile.resetDefault')}
          </button>
          
          <button onClick={onLogout} className="btn-3d w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-6 text-sm" style={{ background: 'var(--danger)', color: 'white' }}>
            <LogOut size={18} /> {t('profile.logout')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default UserProfile;
