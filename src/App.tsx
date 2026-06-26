// Main Application Shell
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import StudentView from './components/StudentView';
import ParentView from './components/ParentView';
import Settings from './components/Settings';
import { syncFromSupabase } from './services/db';

type ActiveTab = 'student' | 'parent' | 'settings';

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
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'student' && <StudentView key={isSynced ? 'synced' : 'pending'} />}
      {activeTab === 'parent' && <ParentView key={isSynced ? 'synced' : 'pending'} />}
      {activeTab === 'settings' && <Settings key={isSynced ? 'synced' : 'pending'} />}
    </Layout>
  );
}

export default App;
