// Main Application Shell
import React, { useState, useEffect, Suspense } from 'react';
import Layout from './components/Layout';
import { syncFromSupabase } from './services/db';
import { PostureProvider, usePostureContext } from './contexts/PostureContext';
import { Toaster } from 'react-hot-toast';
import { useMediaQuery } from 'react-responsive';
import { User, Smartphone, ShieldCheck } from 'lucide-react';

// Lazy loaded components for code splitting
const StudentView = React.lazy(() => import('./components/StudentView'));
const ParentView = React.lazy(() => import('./components/ParentView'));
const Settings = React.lazy(() => import('./components/Settings'));
const PetProfile = React.lazy(() => import('./components/PetProfile'));
const FloatingPet = React.lazy(() => import('./components/FloatingPet'));
const EyeExercise = React.lazy(() => import('./components/EyeExercise'));

type ActiveTab = 'student' | 'parent' | 'pet' | 'settings';

export type AppMode = 'student_front' | 'student_side' | 'parent';

function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('student');
  const [isMobileModeSelected, setIsMobileModeSelected] = useState<boolean>(false);
  const [appMode, setAppMode] = useState<AppMode | null>(null);

  const [isSynced, setIsSynced] = useState<boolean>(false);
  const { eyeExerciseTriggered, onEyeExerciseComplete, metrics, poseLandmarks, setCameraMode } = usePostureContext();
  const isMobile = useMediaQuery({ maxWidth: 768 });

  useEffect(() => {
    syncFromSupabase().then((success) => {
      if (success) {
        setIsSynced(true);
      }
    });
  }, []);

  // Simple loading fallback
  const LoadingFallback = () => (
    <div className="flex items-center justify-center h-full w-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  const handleModeSelect = (mode: AppMode) => {
    setAppMode(mode);
    setIsMobileModeSelected(true);
    if (mode === 'parent') {
      setActiveTab('parent');
    } else if (mode === 'student_side') {
      setCameraMode('side');
      setActiveTab('student');
    } else {
      setCameraMode('front');
      setActiveTab('student');
    }
  };

  // Mobile Mode Selector UI
  if (isMobile && !isMobileModeSelected) {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-50 flex flex-col p-6 items-center justify-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 mb-6">
          <Smartphone size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Chọn Chế Độ Hoạt Động</h2>
        <p className="text-gray-500 text-center mb-8 text-sm">Vui lòng chọn vai trò của bạn trên thiết bị này.</p>
        
        <div className="w-full max-w-sm space-y-4">
          <button onClick={() => handleModeSelect('student_front')} className="w-full p-4 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:border-blue-500 hover:shadow-md transition-all text-left">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><User size={24} /></div>
            <div>
              <div className="font-bold text-gray-800">Học Sinh (Camera Trước)</div>
              <div className="text-xs text-gray-500 mt-1">Để điện thoại trước mặt (như laptop).</div>
            </div>
          </button>
          
          <button onClick={() => handleModeSelect('student_side')} className="w-full p-4 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:border-purple-500 hover:shadow-md transition-all text-left">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Smartphone size={24} /></div>
            <div>
              <div className="font-bold text-gray-800">Học Sinh (Camera Bên Hông)</div>
              <div className="text-xs text-gray-500 mt-1">Đặt điện thoại quay ngang từ bên hông.</div>
            </div>
          </button>

          <button onClick={() => handleModeSelect('parent')} className="w-full p-4 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:border-green-500 hover:shadow-md transition-all text-left">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl"><ShieldCheck size={24} /></div>
            <div>
              <div className="font-bold text-gray-800">Phụ Huynh Giám Sát</div>
              <div className="text-xs text-gray-500 mt-1">Theo dõi tiến trình của con từ xa.</div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Global Eye Exercise Overlay - renders on top of everything */}
      <Suspense fallback={null}>
        {eyeExerciseTriggered && (
          <EyeExercise
            isBlinking={metrics?.isBlinking || false}
            poseLandmarks={poseLandmarks}
            onComplete={onEyeExerciseComplete}
          />
        )}
      </Suspense>
      
      <Layout activeTab={activeTab} setActiveTab={setActiveTab} appMode={appMode || undefined}>
        <Suspense fallback={<LoadingFallback />}>
          {activeTab === 'student' && <StudentView key={isSynced ? 'synced' : 'pending'} />}
          {activeTab === 'pet' && <PetProfile key={isSynced ? 'synced_pet' : 'pending_pet'} />}
          {activeTab === 'parent' && <ParentView key={isSynced ? 'synced' : 'pending'} />}
          {activeTab === 'settings' && <Settings key={isSynced ? 'synced' : 'pending'} />}
        </Suspense>
      </Layout>
      <Suspense fallback={null}>
        <FloatingPet />
      </Suspense>
      <Toaster position="top-center" />
    </>
  );
}

function App() {
  return (
    <PostureProvider>
      <AppContent />
    </PostureProvider>
  );
}

export default App;
