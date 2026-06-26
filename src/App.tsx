// Main Application Shell

import { useState } from 'react';
import Layout from './components/Layout';
import StudentView from './components/StudentView';
import ParentView from './components/ParentView';
import Settings from './components/Settings';

type ActiveTab = 'student' | 'parent' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('student');

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'student' && <StudentView />}
      {activeTab === 'parent' && <ParentView />}
      {activeTab === 'settings' && <Settings />}
    </Layout>
  );
}

export default App;
