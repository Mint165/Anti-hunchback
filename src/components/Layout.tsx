// Layout Component - Premium Sidebar Design

import React from 'react';
import { LayoutDashboard, Shield, Settings as SettingsIcon, PawPrint } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'student' | 'parent' | 'pet' | 'settings';
  setActiveTab: (tab: 'student' | 'parent' | 'pet' | 'settings') => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const isMobile = useMediaQuery({ maxWidth: 768 });

  const menuItems = [
    { id: 'student', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'pet', name: 'Oliver Pet', icon: PawPrint },
    { id: 'parent', name: 'Parent Sync', icon: Shield },
    { id: 'settings', name: 'Settings', icon: SettingsIcon },
  ] as const;

  return (
    <div className={`app-container ${isMobile ? 'mobile-layout' : ''}`}>

      {/* ─── Sidebar Navigation (Desktop) ─────────────────────────── */}
      {!isMobile && (
        <aside className="premium-sidebar">
          
          {/* Brand */}
          <div className="sidebar-brand">
            <div className="sidebar-logo">O</div>
            <div>
              <h2>Oliver AI</h2>
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
          <div className="sidebar-footer">
            <div className="user-avatar">
              H
            </div>
            <div className="user-info">
              <div className="user-name">Học Sinh</div>
              <div className="user-plan">Pro Plan</div>
            </div>
          </div>
        </aside>
      )}

      {/* ─── Main Content Area ───────────────────────────── */}
      <main className="premium-main">
        {children}
      </main>

      {/* ─── Bottom Navigation (Mobile) ───────────────────────────── */}
      {isMobile && (
        <div className="bottom-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
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
