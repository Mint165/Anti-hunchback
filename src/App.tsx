// Main Application Shell
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import StudentView from './components/StudentView';
import ParentView from './components/ParentView';
import Settings from './components/Settings';
import PetProfile from './components/PetProfile';
import FloatingPet from './components/FloatingPet';
import { syncFromSupabase } from './services/db';
import { PostureProvider } from './contexts/PostureContext';

type ActiveTab = 'student' | 'parent' | 'pet' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('student');
  const [isSynced, setIsSynced] = useState<boolean>(false);

  useEffect(() => {
    syncFromSupabase().then((success) => {
      if (success) {
        setIsSynced(true);
      }
    });
  }, []);

  return (
    <PostureProvider>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {activeTab === 'student' && <StudentView key={isSynced ? 'synced' : 'pending'} />}
        {activeTab === 'pet' && <PetProfile key={isSynced ? 'synced_pet' : 'pending_pet'} />}
        {activeTab === 'parent' && <ParentView key={isSynced ? 'synced' : 'pending'} />}
        {activeTab === 'settings' && <Settings key={isSynced ? 'synced' : 'pending'} />}
      </Layout>
      <FloatingPet />
    </PostureProvider>
  );
}

export default App;
