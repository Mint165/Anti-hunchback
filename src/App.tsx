// Main Application Shell
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import StudentView from './components/StudentView';
import ParentView from './components/ParentView';
import Settings from './components/Settings';
import PetProfile from './components/PetProfile';
import FloatingPet from './components/FloatingPet';
import EyeExercise from './components/EyeExercise';
import { syncFromSupabase } from './services/db';
import { PostureProvider, usePostureContext } from './contexts/PostureContext';

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

  return (
    <>
      {/* Global Eye Exercise Overlay - renders on top of everything */}
      {eyeExerciseTriggered && (
        <EyeExercise
          isBlinking={metrics?.isBlinking || false}
          poseLandmarks={poseLandmarks}
          onComplete={onEyeExerciseComplete}
        />
      )}
      
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {activeTab === 'student' && <StudentView key={isSynced ? 'synced' : 'pending'} />}
        {activeTab === 'pet' && <PetProfile key={isSynced ? 'synced_pet' : 'pending_pet'} />}
        {activeTab === 'parent' && <ParentView key={isSynced ? 'synced' : 'pending'} />}
        {activeTab === 'settings' && <Settings key={isSynced ? 'synced' : 'pending'} />}
      </Layout>
      <FloatingPet />
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
