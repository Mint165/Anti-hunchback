// Layout Component - Premium Sidebar Design

import React from 'react';
import { LayoutDashboard, Shield, Settings as SettingsIcon } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'student' | 'parent' | 'settings';
  setActiveTab: (tab: 'student' | 'parent' | 'settings') => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'student', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'parent', name: 'Parent Sync', icon: Shield },
    { id: 'settings', name: 'Settings', icon: SettingsIcon },
  ] as const;

  return (
    <div className="app-container">

      {/* ─── Sidebar Navigation ─────────────────────────── */}
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

      {/* ─── Main Content Area ───────────────────────────── */}
      <main className="premium-main">
        {children}
      </main>

    </div>
  );
};

export default Layout;
