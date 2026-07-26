// Main Application Shell — with PageTransition animations
import React, { useState, useEffect, Suspense } from 'react';
import Layout from './components/Layout';
import { syncFromSupabase, migrateLegacyDataIfNeeded, clearUserDataOnLogout, subscribeToSupabaseChanges, pullStudentDataForParent } from './services/db';
import { supabase } from './services/supabase';
import { PostureProvider, usePostureContext } from './contexts/PostureContext';
import { Toaster } from 'react-hot-toast';
import { AuthScreen } from './components/AuthScreen';
import type { AuthUser } from './components/AuthScreen';
import { UserProfile } from './components/UserProfile';
import { LanguageProvider } from './contexts/LanguageContext';
import PageTransition from './components/ui/PageTransition';
import { FpsOverlay } from './components/ui/FpsOverlay';

// Lazy loaded components for code splitting
const StudentView = React.lazy(() => import('./components/StudentView'));
const ParentView = React.lazy(() => import('./components/ParentView'));
const Settings = React.lazy(() => import('./components/Settings'));
const PetProfile = React.lazy(() => import('./components/PetProfile'));
const FloatingPet = React.lazy(() => import('./components/FloatingPet'));
const EyeExercise = React.lazy(() => import('./components/EyeExercise'));
const Notifications = React.lazy(() => import('./components/Notifications'));

export type AppTab = 'student' | 'parent' | 'pet' | 'settings' | 'notifications';
export type AppMode = 'student' | 'parent';

function AppContent() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const savedUser = localStorage.getItem('oliver_current_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [activeTab, setActiveTab] = useState<AppTab>('student');
  const [showProfile, setShowProfile] = useState(false);
  const [isSynced, setIsSynced] = useState<boolean>(false);

  useEffect(() => {
    // Check dark mode
    if (localStorage.getItem('oliver_dark_mode') === 'true') {
      document.documentElement.classList.add('dark');
    }

    // Listen to Supabase auth state changes
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const metadata = session.user.user_metadata || {};
          setUser({
            id: session.user.id,
            name: metadata.name || session.user.email?.split('@')[0] || 'User',
            role: metadata.role || 'student',
            linkedCode: metadata.linkedCode,
            parentLinkedCode: metadata.parentLinkedCode,
          });
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const metadata = session.user.user_metadata || {};
          setUser({
            id: session.user.id,
            name: metadata.name || session.user.email?.split('@')[0] || 'User',
            role: metadata.role || 'student',
            linkedCode: metadata.linkedCode,
            parentLinkedCode: metadata.parentLinkedCode,
          });
        } else {
          setUser(null);
        }
      });

      return () => subscription.unsubscribe();
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
        // Sync debug log — useful when diagnosing cross-device data flow
        // (verifies Supabase is reachable, schema is in place, and the
        // pull didn't silently no-op). Visible in devtools console.
        console.info('[sync] result:', success, '| user:', user.id ?? 'default');
      });
      // Migrate legacy unscoped localStorage data (oliver_user_stats,
      // oliver_study_sessions, ...) to user-scoped keys once per user
      // so existing users don't lose history when the keys become
      // scoped. No-op if already migrated or user is 'default'.
      if (user.id) migrateLegacyDataIfNeeded(user.id);
    } else {
      setIsSynced(false);
    }
  }, [user]);

  // Subscribe to Supabase Realtime changes for the current user's own
  // rows: settings (existing), sessions + user_stats (new). When
  // another device logged into the same account saves a session or
  // updates stats, this device receives a postgres_changes event and
  // re-pulls the affected data so the local view stays current
  // without a full page reload. The callbacks just re-run the sync
  // pull — granular row merging isn't worth the complexity here.
  useEffect(() => {
    if (!user?.id || !supabase) return;
    const unsubscribe = subscribeToSupabaseChanges(
      // onSettingsChange — settings are applied inline by the
      // existing payload mapping inside the helper; no extra work
      // needed here.
      () => {},
      // onSessionsChange — re-pull sessions so StudentView/ParentView
      // history tables update.
      () => { syncFromSupabase().then(() => setIsSynced(true)); },
      // onStatsChange — re-pull stats so header counters and pet
      // state update.
      () => { syncFromSupabase().then(() => setIsSynced(true)); },
    );
    return () => { unsubscribe(); };
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('oliver_current_user', JSON.stringify(user));
      // Parent may legitimately be on parent / settings / notifications tabs.
      // Only redirect away from student-only tabs (student / pet).
      if (user.role === 'parent' && (activeTab === 'student' || activeTab === 'pet')) {
        setActiveTab('parent');
      } else if (user.role === 'student' && (activeTab === 'parent' || activeTab === 'notifications')) {
        setActiveTab('student');
      }
    } else {
      localStorage.removeItem('oliver_current_user');
    }
  }, [user]);

  const handleLogin = (loggedInUser: AuthUser) => {
    setUser(loggedInUser);
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    // Wipe the per-user scoped localStorage keys so the next account
    // that logs in on this browser starts fresh (no session count
    // bleed, no stale stats). Legacy unscoped keys and `oliver_users`
    // (auth list) are intentionally preserved by clearUserDataOnLogout.
    if (user?.id) clearUserDataOnLogout(user.id);
    setUser(null);
    setShowProfile(false);
  };

  // Task 6b: persist the parent's linked code to Supabase so it survives
  // across devices / sessions, not just local state. Falls back to
  // local-only mode when Supabase isn't configured (per the project's
  // local-only mode documented in the constitution).
  const handleUpdateParentCode = async (code: string) => {
    if (!user) return;
    const updatedUser = { ...user, parentLinkedCode: code };
    setUser(updatedUser);
    // Mirror to localStorage so the value is available immediately on
    // reload even before Supabase auth state re-hydrates.
    localStorage.setItem('oliver_current_user', JSON.stringify(updatedUser));

    if (supabase) {
      try {
        // 1. Update auth.user.user_metadata so onAuthStateChange picks it up.
        const { error: authErr } = await supabase.auth.updateUser({
          data: { parentLinkedCode: code },
        });
        if (authErr) throw authErr;
        // 2. Mirror to the public.profiles row so the SECURITY DEFINER RPC
        //    in supabase_schema.sql (Task 6c) can read it when the parent
        //    requests the linked student's data.
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({ parent_linked_code: code, updated_at: new Date().toISOString() })
          .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '');
        if (profileErr) {
          // Non-fatal: the auth metadata is the source of truth the client
          // uses; the profile row is for cross-account RLS lookups.
          console.warn('Failed to mirror parentLinkedCode to profiles row:', profileErr.message);
        } else if (code) {
          // Trigger an immediate pull of the linked student's data so the
          // parent sees real numbers within ~1s of clicking Save, instead
          // of waiting for the 5s poll in ParentView to fire for the first
          // time. Errors are swallowed — ParentView's poll will retry.
          pullStudentDataForParent(code).catch((e) => {
            console.warn('Initial parent-link pull failed (will retry on poll):', e?.message || e);
          });
        }
      } catch (e: any) {
        console.error('Failed to persist parentLinkedCode to Supabase:', e?.message || e);
      }
    }
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
      case 'notifications':
        return user.role === 'parent' ? <Notifications key={isSynced ? 'synced_notif' : 'pending_notif'} /> : null;
      case 'settings':
        return <Settings key={isSynced ? 'synced' : 'pending'} />;
      default:
        return null;
    }
  };

  // Per the constitution: "Không sử dụng camera của thiết bị dù là di
  // động hay máy tính khi người dùng sử dụng tài khoản phụ huynh."
  // PostureProvider unconditionally calls useMediaPipe() at mount,
  // which calls getUserMedia() and loads the MediaPipe model from
  // CDN — both undesirable for parents. So we only mount PostureProvider
  // for students, wrapping the entire student tree (Layout + tab
  // content + extras). The parent flow renders without it.
  const isStudent = user.role === 'student';

  // The student-only extras (eye-exercise overlay, motion-pause class,
  // FloatingPet) consume PostureContext, so they must live inside the
  // provider. They're rendered as a sibling to Layout's children so
  // they overlay the whole screen.
  const studentExtras = isStudent ? <StudentExtras /> : null;

  return (
    <PostureProviderWrapper enabled={isStudent}>
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

      {studentExtras}

      {/* Dev-only FPS overlay — stripped from production builds. Mounts
          globally so we can measure FPS across all tabs (student/parent/
          settings/pet) before/after the Task D perf package. */}
      {import.meta.env.DEV && <FpsOverlay />}
      <Toaster position="top-center" />
    </PostureProviderWrapper>
  );
}

// Wrapper that mounts PostureProvider only when `enabled` is true.
// When disabled (parent flow), children render without a provider so
// useMediaPipe / getUserMedia / MediaPipe CDN fetch never happen.
const PostureProviderWrapper: React.FC<{ enabled: boolean; children: React.ReactNode }> = ({ enabled, children }) => {
  if (!enabled) return <>{children}</>;
  return <PostureProvider>{children}</PostureProvider>;
};

// Student-only extras that need to consume PostureContext: the eye
// exercise overlay (reads metrics + poseLandmarks), the page-wide
// motion-pause class (reads eyeExerciseTriggered), and FloatingPet
// (reads metrics/hasStarted/alertLevel/eyeExerciseTriggered). Must
// be mounted INSIDE <PostureProvider> so useContext(PostureContext)
// resolves to the real provider value.
function StudentExtras() {
  const { eyeExerciseTriggered, onEyeExerciseComplete, metrics, poseLandmarks } = usePostureContext();

  // Pause decorative page-wide motion (CSS animations, framer-motion page
  // transitions, WebGL pet animations via the `paused` prop) while the eye
  // exercise overlay is open. This frees CPU/GPU for the foreground minigame
  // and matches the constitution's "tăng fps và giảm chuyển động phức tạp của
  // trang web khi phần này hiện lên" requirement. The class is mirrored from
  // `@media (prefers-reduced-motion: reduce)` so the same CSS rules apply.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('motion-paused', eyeExerciseTriggered);
    return () => root.classList.remove('motion-paused');
  }, [eyeExerciseTriggered]);

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
      <Suspense fallback={null}>
        <FloatingPet />
      </Suspense>
    </>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
