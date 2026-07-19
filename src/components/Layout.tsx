// Layout Component - Premium Sidebar Design

import React from 'react';
import { LayoutDashboard, Shield, Settings as SettingsIcon, PawPrint, Eye, Globe } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';
import type { AuthUser } from './AuthScreen';
import { useLanguage } from '../contexts/LanguageContext';

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

      {/* ─── Sidebar Navigation (Desktop) ─────────────────────────── */}
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
              
              // Hide student tabs if parent, hide parent tabs if student
              if (displayUser.role === 'parent' && (item.id === 'student' || item.id === 'pet')) return null;
              if (displayUser.role === 'student' && item.id === 'parent') return null;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  {item.name}
                </button>
              );
            })}
          </nav>

          {/* Bottom User Area or Footer */}
          <div className="sidebar-footer cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-xl p-2 transition-colors" onClick={onAvatarClick}>
            <div className="user-avatar bg-gradient-to-br from-primary to-purple-600 text-white font-black text-lg">
              {displayUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <div className="user-name truncate max-w-[130px]">{displayUser.name}</div>
              <div className="user-plan text-xs">{displayUser.role === 'student' ? t('layout.roleStudent') : t('layout.roleParent')}</div>
            </div>
          </div>
        </aside>
      )}

      {/* ─── Main Content Area ───────────────────────────── */}
      <main className="premium-main relative">
        {/* Language Toggle Inside Main Area */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-[100] flex items-center gap-2 bg-white/20 dark:bg-slate-900/40 backdrop-blur-md px-4 py-2 rounded-full border border-gray-200 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all">
          <Globe size={18} className="text-gray-500 dark:text-gray-300" />
          <button 
            onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
            className="text-sm font-bold text-gray-800 dark:text-white hover:text-primary transition-colors flex items-center gap-2"
          >
            <span className={lang === 'vi' ? 'text-primary' : 'text-gray-500'}>VI</span>
            <span className="w-8 h-4 bg-gray-300 dark:bg-gray-600 rounded-full relative inline-block transition-colors">
              <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${lang === 'en' ? 'translate-x-4' : ''}`}></span>
            </span>
            <span className={lang === 'en' ? 'text-primary' : 'text-gray-500'}>EN</span>
          </button>
        </div>

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
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              >
                <div className="bottom-nav-icon">
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default Layout;
