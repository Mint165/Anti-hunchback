// Layout — Sidebar rail (Student) / full sidebar (Parent) + gradient mesh bg.
// Replaces the WebGL ParticleBackground with the CSS-only GradientMesh.
import React from 'react';
import {
  LayoutDashboard,
  Shield,
  Settings as SettingsIcon,
  PawPrint,
  Eye,
  Globe,
} from 'lucide-react';
import { useMediaQuery } from 'react-responsive';
import { motion } from 'framer-motion';
import type { AuthUser } from './AuthScreen';
import { useLanguage } from '../contexts/LanguageContext';
import GradientMesh from './ui/GradientMesh';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'student' | 'parent' | 'pet' | 'settings';
  setActiveTab: (tab: 'student' | 'parent' | 'pet' | 'settings') => void;
  appMode?: string;
  onAvatarClick?: () => void;
  user?: AuthUser;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  appMode,
  onAvatarClick,
  user,
}) => {
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const { t, lang, setLang } = useLanguage();
  const isParent = (user?.role ?? appMode) === 'parent';

  const menuItems = [
    { id: 'student', name: t('layout.dashboard'), icon: LayoutDashboard },
    { id: 'pet', name: t('layout.pet'), icon: PawPrint },
    { id: 'parent', name: t('layout.parentSync'), icon: Shield },
    { id: 'settings', name: t('layout.settings'), icon: SettingsIcon },
  ] as const;

  const displayUser = user || { name: t('layout.studentDefault'), role: 'student' };

  const visibleItems = menuItems.filter((item) => {
    if (displayUser.role === 'parent' && (item.id === 'student' || item.id === 'pet')) return false;
    if (displayUser.role === 'student' && item.id === 'parent') return false;
    return true;
  });

  return (
    <div className={`${styles.appShell} ${isMobile ? styles.mobile : ''}`}>
      {/* CSS-only gradient mesh background (replaces WebGL ParticleBackground) */}
      <GradientMesh opacity={isParent ? 0.4 : 0.65} />

      {/* ─── Sidebar (Desktop) ─────────────────────────────────────── */}
      {!isMobile && (
        <aside className={`${styles.rail} ${isParent ? styles.railParent : ''}`}>
          {/* Brand */}
          <div className={styles.brand}>
            <div className={styles.brandLogo}>
              <Eye size={20} className="text-white" />
            </div>
            <h2 className={styles.brandName}>MediEdu</h2>
          </div>

          <div className={styles.sectionLabel}>{t('layout.mainMenu')}</div>

          {/* Navigation */}
          <nav className={styles.menu}>
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <span className={styles.itemIcon}>
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  <span className={styles.itemLabel}>{item.name}</span>
                </motion.button>
              );
            })}
          </nav>

          {/* Language toggle */}
          <div className={styles.langRow}>
            <Globe size={16} style={{ color: 'var(--primary)' }} />
            <button
              onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
              className={styles.langButton}
            >
              <span className={lang === 'vi' ? styles.langLabelActive : styles.langLabelInactive}>VI</span>
              <span className={styles.langTrack}>
                <motion.span
                  className={styles.langThumb}
                  animate={{ x: lang === 'en' ? 14 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </span>
              <span className={lang === 'en' ? styles.langLabelActive : styles.langLabelInactive}>EN</span>
            </button>
          </div>

          {/* User footer */}
          <div className={styles.footer} onClick={onAvatarClick}>
            <div className={styles.avatar}>
              {displayUser.name.charAt(0).toUpperCase()}
            </div>
            <div className={`${styles.userInfo} ${styles.userInfoHidden}`}>
              <div className={styles.userName}>{displayUser.name}</div>
              <div className={styles.userRole}>
                {displayUser.role === 'student' ? t('layout.roleStudent') : t('layout.roleParent')}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ─── Main Content ────────────────────────────────────────── */}
      <main className={`${styles.main} ${isParent ? styles.mainParent : ''}`}>
        {isMobile && (
          <div className={styles.mobileLangRow}>
            <button
              onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
              className={styles.mobileLangBtn}
            >
              <Globe size={14} />
              {lang === 'vi' ? 'EN' : 'VI'}
            </button>
          </div>
        )}

        {children}
      </main>

      {/* ─── Mobile bottom nav ─────────────────────────────────────── */}
      {isMobile && appMode !== 'parent' && (
        <div className={styles.bottomNav}>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`${styles.bottomNavItem} ${isActive ? styles.bottomNavItemActive : ''}`}
                whileTap={{ scale: 0.9 }}
              >
                <div className={styles.bottomNavIcon}>
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