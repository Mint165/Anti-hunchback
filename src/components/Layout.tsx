// Top Navigation Layout Component

import React from 'react';
import { Home, Shield, Settings as SettingsIcon, GraduationCap } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: 'student' | 'parent' | 'settings';
  setActiveTab: (tab: 'student' | 'parent' | 'settings') => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'student', name: 'Góc Học Sinh', icon: Home },
    { id: 'parent', name: 'Góc Phụ Huynh', icon: Shield },
    { id: 'settings', name: 'Cài Đặt', icon: SettingsIcon },
  ] as const;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* ─── Top Navigation Bar ─────────────────────────── */}
      <header className="top-nav">

        {/* Brand */}
        <div className="nav-brand">
          <div className="nav-brand-logo">🐼</div>
          <div className="nav-brand-text">
            <h2>Oliver AI</h2>
            <span>Sức khỏe học đường</span>
          </div>
        </div>

        {/* Navigation Tabs (pill group) */}
        <nav className="nav-tabs">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`nav-tab ${isActive ? 'active' : ''}`}
              >
                <Icon size={15} />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Right-side actions */}
        <div className="nav-actions">
          {/* Camera tip tooltip */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-green-700"
            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
          >
            <GraduationCap size={14} />
            <span className="hidden lg:inline">Camera ngang tầm mắt, cách 50–70cm</span>
          </div>
        </div>

      </header>

      {/* ─── Main Content Area ───────────────────────────── */}
      <main className="page-container">
        {children}
      </main>

    </div>
  );
};

export default Layout;
