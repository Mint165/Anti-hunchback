import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import type { AuthUser } from './AuthScreen';
import { X, Save, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

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
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-sm h-full shadow-2xl flex flex-col relative"
        style={{ background: 'var(--bg-page)' }}
      >
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
          <h2 className="text-xl font-black" style={{ color: 'var(--text-main)' }}>{t('profile.title')}</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black shadow-lg mb-4" style={{ background: 'var(--primary)', color: 'white' }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-2xl font-black mb-1" style={{ color: 'var(--text-main)' }}>{user.name}</h3>
            <div className="px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest mt-2" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              {user.role === 'student' ? t('profile.roleStudent') : t('profile.roleParent')}
            </div>
          </div>

          <div className="space-y-6">
            {user.role === 'student' && user.linkedCode && (
              <div className="p-5 rounded-2xl" style={{ background: 'var(--bg-page)', border: '2px solid rgba(124,58,237,0.1)' }}>
                <p className="text-sm mb-3 font-medium" style={{ color: 'var(--text-muted)' }}>{t('profile.linkCodeDesc')}</p>
                <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>{t('profile.linkCodeLabel')}</div>
                <div className="text-3xl font-black text-center tracking-[0.2em] py-3 rounded-xl shadow-inner" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                  {user.linkedCode}
                </div>
              </div>
            )}

            {user.role === 'parent' && (
              <div className="p-5 rounded-2xl" style={{ background: 'var(--bg-page)', border: '2px solid rgba(124,58,237,0.1)' }}>
                <p className="text-sm mb-3 font-medium" style={{ color: 'var(--text-muted)' }}>{t('profile.parentLinkDesc')}</p>
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
        </div>

        <div className="p-6 border-t" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
          <button onClick={onLogout} className="btn-3d w-full flex items-center justify-center gap-2 py-4" style={{ background: 'var(--danger-light)', color: 'var(--danger)', borderBottomColor: 'rgba(239,68,68,0.3)' }}>
            <LogOut size={20} />
            {t('profile.logout')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default UserProfile;
