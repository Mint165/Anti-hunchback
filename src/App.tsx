// Main Application Shell
import React, { useState, useEffect, Suspense } from 'react';
import Layout from './components/Layout';
import { syncFromSupabase } from './services/db';
import { PostureProvider, usePostureContext } from './contexts/PostureContext';
import { Toaster } from 'react-hot-toast';

// Lazy loaded components for code splitting
const StudentView = React.lazy(() => import('./components/StudentView'));
const ParentView = React.lazy(() => import('./components/ParentView'));
const Settings = React.lazy(() => import('./components/Settings'));
const PetProfile = React.lazy(() => import('./components/PetProfile'));
const FloatingPet = React.lazy(() => import('./components/FloatingPet'));
const EyeExercise = React.lazy(() => import('./components/EyeExercise'));

type ActiveTab = 'student' | 'parent' | 'pet' | 'settings';

// Inner component that can use PostureContext
function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('student');
  const [isSynced, setIsSynced] = useState<boolean>(false);
  const { eyeExerciseTriggered, onEyeExerciseComplete, metrics, poseLandmarks } = usePostureContext();

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
      
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
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
