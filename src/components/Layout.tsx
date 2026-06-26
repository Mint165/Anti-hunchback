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
    <div className="flex h-screen w-screen overflow-hidden">

      {/* ─── Sidebar Navigation ─────────────────────────── */}
      <aside className="premium-sidebar">
        
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">O</div>
          <div>
            <h2>Oliver AI</h2>
          </div>
        </div>

        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 pl-4">
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
        <div className="mt-auto pt-6 border-t border-gray-100 flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-100 to-blue-100 flex items-center justify-center text-purple-600 font-bold shadow-sm">
            H
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-gray-800">Học Sinh</div>
            <div className="text-xs text-gray-400 font-medium">Pro Plan</div>
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
