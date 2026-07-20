// Main Application Shell — with PageTransition animations
import React, { useState, useEffect, Suspense } from 'react';
import Layout from './components/Layout';
import { syncFromSupabase } from './services/db';
import { PostureProvider, usePostureContext } from './contexts/PostureContext';
import { Toaster } from 'react-hot-toast';
import { AuthScreen } from './components/AuthScreen';
import type { AuthUser } from './components/AuthScreen';
import { UserProfile } from './components/UserProfile';
import { LanguageProvider } from './contexts/LanguageContext';
import PageTransition from './components/ui/PageTransition';

// Lazy loaded components for code splitting
const StudentView = React.lazy(() => import('./components/StudentView'));
const ParentView = React.lazy(() => import('./components/ParentView'));
const Settings = React.lazy(() => import('./components/Settings'));
const PetProfile = React.lazy(() => import('./components/PetProfile'));
const FloatingPet = React.lazy(() => import('./components/FloatingPet'));
const EyeExercise = React.lazy(() => import('./components/EyeExercise'));

export type AppTab = 'student' | 'parent' | 'pet' | 'settings';
export type AppMode = 'student' | 'parent';

function AppContent() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const savedUser = localStorage.getItem('oliver_current_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [activeTab, setActiveTab] = useState<AppTab>('student');
  const [showProfile, setShowProfile] = useState(false);
  const [isSynced, setIsSynced] = useState<boolean>(false);
  const { eyeExerciseTriggered, onEyeExerciseComplete, metrics, poseLandmarks } = usePostureContext();
  
  useEffect(() => {
    // Check dark mode
    if (localStorage.getItem('oliver_dark_mode') === 'true') {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Apply theme attribute based on user role (Student vs Parent)
  useEffect(() => {
    const root = document.documentElement;
    if (user) {
      root.setAttribute('data-theme', user.role === 'parent' ? 'parent' : 'student');
    } else {
      // Default to student theme on auth screen
      root.setAttribute('data-theme', 'student');
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      syncFromSupabase().then((success) => {
        if (success) {
          setIsSynced(true);
        }
      });
    } else {
      setIsSynced(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('oliver_current_user', JSON.stringify(user));
      if (user.role === 'parent' && activeTab !== 'parent' && activeTab !== 'settings') {
        setActiveTab('parent');
      } else if (user.role === 'student' && activeTab === 'parent') {
        setActiveTab('student');
      }
    } else {
      localStorage.removeItem('oliver_current_user');
    }
  }, [user]);

  const handleLogin = (loggedInUser: AuthUser) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
    setShowProfile(false);
  };

  const handleUpdateParentCode = (code: string) => {
    if (!user) return;
    const updatedUser = { ...user, parentLinkedCode: code };
    setUser(updatedUser);
  };

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  // Loading fallback with brand colors
  const LoadingFallback = () => (
    <div className="flex items-center justify-center h-full w-full">
      <div className="spinner" />
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'student':
        return user.role === 'student' ? <StudentView key={isSynced ? 'synced' : 'pending'} /> : null;
      case 'pet':
        return user.role === 'student' ? <PetProfile key={isSynced ? 'synced_pet' : 'pending_pet'} /> : null;
      case 'parent':
        return user.role === 'parent' ? <ParentView key={isSynced ? 'synced' : 'pending'} /> : null;
      case 'settings':
        return <Settings key={isSynced ? 'synced' : 'pending'} />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Global Eye Exercise Overlay */}
      <Suspense fallback={null}>
        {eyeExerciseTriggered && (
          <EyeExercise
            isBlinking={metrics?.isBlinking || false}
            poseLandmarks={poseLandmarks}
            onComplete={onEyeExerciseComplete}
          />
        )}
      </Suspense>
      
      <Layout activeTab={activeTab} setActiveTab={setActiveTab} appMode={user.role} onAvatarClick={() => setShowProfile(true)} user={user}>
        <Suspense fallback={<LoadingFallback />}>
          <PageTransition pageKey={activeTab}>
            {renderTabContent()}
          </PageTransition>
        </Suspense>

        {showProfile && (
          <UserProfile 
            user={user} 
            onClose={() => setShowProfile(false)} 
            onLogout={handleLogout}
            onUpdateParentCode={handleUpdateParentCode}
          />
        )}
      </Layout>
      <Suspense fallback={null}>
        {user.role === 'student' && <FloatingPet />}
      </Suspense>
      <Toaster position="top-center" />
    </>
  );
}

function App() {
  return (
    <LanguageProvider>
      <PostureProvider>
        <AppContent />
      </PostureProvider>
    </LanguageProvider>
  );
}

export default App;
