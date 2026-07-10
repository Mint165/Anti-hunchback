// Layout Component - Premium Sidebar Design

import React from 'react';
import { LayoutDashboard, Shield, Settings as SettingsIcon, PawPrint, Eye } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';
import type { AuthUser } from './AuthScreen';

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

  const menuItems = [
    { id: 'student', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'pet', name: 'Thú cưng MediEdu', icon: PawPrint },
    { id: 'parent', name: 'Parent Sync', icon: Shield },
    { id: 'settings', name: 'Settings', icon: SettingsIcon },
  ] as const;

  const displayUser = user || { name: 'Học Sinh', role: 'student' };

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
            Main Menu
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
              <div className="user-plan text-xs">{displayUser.role === 'student' ? 'Học Sinh' : 'Phụ Huynh'}</div>
            </div>
          </div>
        </aside>
      )}

      {/* ─── Main Content Area ───────────────────────────── */}
      <main className="premium-main">
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
