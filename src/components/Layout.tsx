// Sidebar Navigation Layout Component

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
    <div className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-[#F0F6F1] via-[#E7EFF9] to-[#F5EFFF]">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col justify-between p-6 flex-shrink-0">
        
        {/* Brand/Logo Header */}
        <div>
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-50">
            {/* Minimal Panda circle icon placeholder */}
            <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-black text-xl shadow-sm">
              🐼
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-800 tracking-tight">Oliver AI</h2>
              <span className="text-2xs text-gray-400 font-semibold block uppercase">Sức khỏe học đường</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3.5 px-4.5 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-300 w-full ${
                    isActive
                      ? 'bg-green-600 text-white shadow-sm hover:shadow-md'
                      : 'text-gray-500 hover:text-green-600 hover:bg-green-50/50'
                  }`}
                >
                  <Icon size={18} />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer/Help banner */}
        <div className="bg-green-50/40 border border-green-100/50 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-green-700 font-bold text-xs mb-1">
            <GraduationCap size={16} /> Hướng Dẫn Tư Thế
          </div>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Đặt camera ngang tầm mắt bé, ngồi cách 50-70cm để thuật toán AI đo đạc đúng nhất.
          </p>
        </div>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-hidden flex flex-col">
        {children}
      </main>

    </div>
  );
};
export default Layout;
