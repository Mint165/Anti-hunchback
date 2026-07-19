// Layout Component — Floating Sidebar + Dynamic Island + 3D Particle BG
import React, { Suspense } from 'react';
import { LayoutDashboard, Shield, Settings as SettingsIcon, PawPrint, Eye, Globe } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';
import { motion } from 'framer-motion';
import type { AuthUser } from './AuthScreen';
import { useLanguage } from '../contexts/LanguageContext';

const ParticleBackground = React.lazy(() => import('./ui/ParticleBackground'));

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'student' | 'parent' | 'pet' | 'settings';
  setActiveTab: (tab: 'student' | 'parent' | 'pet' | 'settings') => void;
  appMode?: string;
  onAvatarClick?: () => void;
  user?: AuthUser;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, appMode, onAvatarClick, user }) => {
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const { t, lang, setLang } = useLanguage();

  const menuItems = [
    { id: 'student', name: t('layout.dashboard'), icon: LayoutDashboard },
    { id: 'pet', name: t('layout.pet'), icon: PawPrint },
    { id: 'parent', name: t('layout.parentSync'), icon: Shield },
    { id: 'settings', name: t('layout.settings'), icon: SettingsIcon },
  ] as const;

  const displayUser = user || { name: t('layout.studentDefault'), role: 'student' };

  return (
    <div className={`app-container ${isMobile ? 'mobile-layout' : ''}`}>

      {/* 3D Particle Background */}
      <Suspense fallback={null}>
        <ParticleBackground />
      </Suspense>

      {/* ─── Floating Sidebar (Desktop) ─────────────────────────── */}
      {!isMobile && (
        <aside className="premium-sidebar">
          {/* Brand */}
          <div className="sidebar-brand">
            <div className="sidebar-logo">
              <Eye size={20} className="text-white" />
            </div>
            <div>
              <h2>MediEdu</h2>
            </div>
          </div>

          <div className="sidebar-section-title">
            {t('layout.mainMenu')}
          </div>

          {/* Navigation Tabs */}
          <nav className="sidebar-menu">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              if (displayUser.role === 'parent' && (item.id === 'student' || item.id === 'pet')) return null;
              if (displayUser.role === 'student' && item.id === 'parent') return null;

              return (
                <motion.button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  whileHover={{ x: isActive ? 0 : 4 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  {item.name}
                </motion.button>
              );
            })}
          </nav>

          {/* Language Toggle */}
          <div className="flex items-center gap-3 px-3 py-3 mb-3 rounded-xl" style={{ background: 'var(--primary-light)' }}>
            <Globe size={16} style={{ color: 'var(--primary)' }} />
            <button
              onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
              className="flex items-center gap-2 text-sm font-bold"
              style={{ color: 'var(--text-main)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <span style={{ color: lang === 'vi' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: lang === 'vi' ? 900 : 600 }}>VI</span>
              <span
                style={{
                  width: 32,
                  height: 18,
                  background: 'var(--primary)',
                  borderRadius: 9999,
                  position: 'relative',
                  display: 'inline-block',
                }}
              >
                <motion.span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: 2,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: 'white',
                  }}
                  animate={{ x: lang === 'en' ? 14 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </span>
              <span style={{ color: lang === 'en' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: lang === 'en' ? 900 : 600 }}>EN</span>
            </button>
          </div>

          {/* User Area */}
          <div className="sidebar-footer cursor-pointer hover:opacity-80 rounded-xl p-2 transition-all" onClick={onAvatarClick}>
            <div className="user-avatar">
              {displayUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <div className="user-name truncate max-w-[130px]">{displayUser.name}</div>
              <div className="user-plan">{displayUser.role === 'student' ? t('layout.roleStudent') : t('layout.roleParent')}</div>
            </div>
          </div>
        </aside>
      )}

      {/* ─── Main Content Area ───────────────────────────── */}
      <main className="premium-main relative">
        {/* Mobile language toggle */}
        {isMobile && (
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
              className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', cursor: 'pointer' }}
            >
              <Globe size={14} />
              {lang === 'vi' ? 'EN' : 'VI'}
            </button>
          </div>
        )}

        {children}
      </main>

      {/* ─── Bottom Navigation (Mobile) ───────────────────────────── */}
      {isMobile && appMode !== 'parent' && (
        <div className="bottom-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            if (displayUser.role === 'parent' && (item.id === 'student' || item.id === 'pet')) return null;
            if (displayUser.role === 'student' && item.id === 'parent') return null;

            return (
              <motion.button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                whileTap={{ scale: 0.9 }}
              >
                <div className="bottom-nav-icon">
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span>{item.name}</span>
              </motion.button>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default Layout;
