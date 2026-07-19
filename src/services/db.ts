// Local Storage / Database Service with Supabase synchronization
import type { CalibrationData } from './postureAI';
import { DEFAULT_CALIBRATION } from './postureAI';
import { supabase, isSupabaseConfigured } from './supabase';
import { encryptData, decryptData } from '../utils/crypto';

async function getUserId(): Promise<string> {
  if (!isSupabaseConfigured || !supabase) return 'default';
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id || 'default';
}

export interface AppSettings {
  screenDistanceThreshold: number; // default 50cm
  neckTiltThreshold: number;       // default 20 deg
  shoulderTiltThreshold: number;   // default 7 deg
  slouchThreshold: number;         // default 15 deg
  minBlinkRate: number;            // default 4 per min
  maxBlinkRate: number;            // default 25 per min
  sessionBreakInterval: number;    // default 45 mins
  eyeExerciseInterval: number;     // default 20 mins
  soundAlertEnabled: boolean;
}

export interface SessionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: number;
  endTime: number;
  durationMinutes: number;
  averageHealthScore: number;
  goodPosturePercentage: number;
  warningsCount: number;
  blinksCount: number;
  fidgetFlagsCount: number;
  completedEyeExercises: number;
  streakAdded: boolean;
  // Data Analytics fields
  averageShoulderTilt?: number;
  averageNeckAngle?: number;
  averageSlouchAngle?: number;
  fatigueFlags?: number;
}

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  lastSessionDate: string | null;
  totalStudyTime: number; // minutes
  badges: string[]; // unlocked badge ids
  petXp: number;
  petLevel: number;
  petGoodPostureStreak: number; // in seconds
  // New Gamification Fields
  coins: number;
  unlockedItems: string[];
  equippedItems: Record<string, string>; // e.g. { head: 'crown_gold', eyes: 'sunglasses' }
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  icon: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  screenDistanceThreshold: 50,
  neckTiltThreshold: 20,
  shoulderTiltThreshold: 7,
  slouchThreshold: 15,
  minBlinkRate: 4,
  maxBlinkRate: 25,
  sessionBreakInterval: 45,
  eyeExerciseInterval: 20,
  soundAlertEnabled: true,
};

const STORAGE_KEYS = {
  CALIBRATION: 'oliver_calibration_data',
  SETTINGS: 'oliver_app_settings',
  SESSIONS: 'oliver_study_sessions',
  STATS: 'oliver_user_stats',
};

// --- Background Supabase Pushes ---
async function pushCalibrationToSupabase(data: CalibrationData) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const userId = await getUserId();
    if (userId === 'default') return;
    await supabase.from('calibration').upsert({
      user_id: userId,
      base_eye_distance: data.baseEyeDistance,
      base_neck_y_offset: data.baseNeckYOffset,
      base_shoulder_y_diff: data.baseShoulderYDiff,
      base_torso_height: data.baseTorsoHeight,
      base_ear: data.baseEAR
    });
  } catch (err) {
    console.error('Failed to sync calibration to Supabase:', err);
  }
}

async function pushSettingsToSupabase(settings: AppSettings) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const userId = await getUserId();
    if (userId === 'default') return;
    await supabase.from('settings').upsert({
      user_id: userId,
      screen_distance_threshold: settings.screenDistanceThreshold,
      neck_tilt_threshold: settings.neckTiltThreshold,
      shoulder_tilt_threshold: settings.shoulderTiltThreshold,
      slouch_threshold: settings.slouchThreshold,
      min_blink_rate: settings.minBlinkRate,
      max_blink_rate: settings.maxBlinkRate,
      session_break_interval: settings.sessionBreakInterval,
      eye_exercise_interval: settings.eyeExerciseInterval,
      sound_alert_enabled: settings.soundAlertEnabled
    });
  } catch (err) {
    console.error('Failed to sync settings to Supabase:', err);
  }
}

async function pushUserStatsToSupabase(stats: UserStats) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const userId = await getUserId();
    if (userId === 'default') return;
    await supabase.from('user_stats').upsert({
      user_id: userId,
      xp: stats.xp,
      level: stats.level,
      streak: stats.streak,
      last_session_date: stats.lastSessionDate,
      total_study_time: stats.totalStudyTime,
      badges: stats.badges,
      coins: stats.coins,
      unlocked_items: stats.unlockedItems,
      equipped_items: stats.equippedItems
    });
  } catch (err) {
    console.error('Failed to sync user stats to Supabase:', err);
  }
}

async function pushSessionToSupabase(record: SessionRecord) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const userId = await getUserId();
    if (userId === 'default') return;
    await supabase.from('sessions').upsert({
      id: record.id,
      user_id: userId,
      date: record.date,
      start_time: record.startTime,
      end_time: record.endTime,
      duration_minutes: record.durationMinutes,
      average_health_score: record.averageHealthScore,
      good_posture_percentage: record.goodPosturePercentage,
      warnings_count: record.warningsCount,
      blinks_count: record.blinksCount,
      fidget_flags_count: record.fidgetFlagsCount,
      completed_eye_exercises: record.completedEyeExercises,
      streak_added: record.streakAdded
    });
  } catch (err) {
    console.error('Failed to sync session to Supabase:', err);
  }
}

// --- Pull synchronization from Supabase ---
export async function syncFromSupabase(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const userId = await getUserId();
    if (userId === 'default') return false;

    // 1. Fetch Calibration
    const { data: calibrationData } = await supabase.from('calibration').select('*').eq('user_id', userId).single();
    if (calibrationData) {
      const calibration: CalibrationData = {
        baseEyeDistance: calibrationData.base_eye_distance,
        baseNeckYOffset: calibrationData.base_neck_y_offset,
        baseShoulderYDiff: calibrationData.base_shoulder_y_diff,
        baseTorsoHeight: calibrationData.base_torso_height,
        baseEAR: calibrationData.base_ear,
      };
      localStorage.setItem(STORAGE_KEYS.CALIBRATION, JSON.stringify(calibration));
    }

    // 2. Fetch Settings
    const { data: settingsData } = await supabase.from('settings').select('*').eq('user_id', userId).single();
    if (settingsData) {
      const settings: AppSettings = {
        screenDistanceThreshold: settingsData.screen_distance_threshold,
        neckTiltThreshold: settingsData.neck_tilt_threshold,
        shoulderTiltThreshold: settingsData.shoulder_tilt_threshold,
        slouchThreshold: settingsData.slouch_threshold,
        minBlinkRate: settingsData.min_blink_rate,
        maxBlinkRate: settingsData.max_blink_rate,
        sessionBreakInterval: settingsData.session_break_interval,
        eyeExerciseInterval: settingsData.eye_exercise_interval,
        soundAlertEnabled: settingsData.sound_alert_enabled,
      };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }

    // 3. Fetch Stats
    const { data: statsData } = await supabase.from('user_stats').select('*').eq('user_id', userId).single();
    if (statsData) {
      const localStatsRaw = localStorage.getItem(STORAGE_KEYS.STATS);
      const localStats = localStatsRaw ? JSON.parse(localStatsRaw) : null;
      const stats: UserStats = {
        xp: statsData.xp,
        level: statsData.level,
        streak: statsData.streak,
        lastSessionDate: statsData.last_session_date,
        totalStudyTime: statsData.total_study_time,
        badges: statsData.badges || [],
        petXp: localStats?.petXp || 0,
        petLevel: localStats?.petLevel || 1,
        petGoodPostureStreak: localStats?.petGoodPostureStreak || 0,
        coins: statsData.coins || localStats?.coins || 0,
        unlockedItems: statsData.unlocked_items || localStats?.unlockedItems || [],
        equippedItems: statsData.equipped_items || localStats?.equippedItems || {},
      };
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    }

    // 4. Fetch Sessions (RLS ensures we only get our own sessions, but we can also filter)
    const { data: sessionsData } = await supabase.from('sessions').select('*').eq('user_id', userId);
    if (sessionsData) {
      const sessions: SessionRecord[] = sessionsData.map(s => ({
        id: s.id,
        date: s.date,
        startTime: Number(s.start_time),
        endTime: Number(s.end_time),
        durationMinutes: s.duration_minutes,
        averageHealthScore: s.average_health_score,
        goodPosturePercentage: s.good_posture_percentage,
        warningsCount: s.warnings_count,
        blinksCount: s.blinks_count,
        fidgetFlagsCount: s.fidget_flags_count,
        completedEyeExercises: s.completed_eye_exercises,
        streakAdded: s.streak_added,
      }));
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    }

    return true;
  } catch (err) {
    console.error('Failed to pull sync from Supabase:', err);
    return false;
  }
}

// --- Calibration ---
export function saveCalibration(data: CalibrationData): void {
  localStorage.setItem(STORAGE_KEYS.CALIBRATION, JSON.stringify(data));
  pushCalibrationToSupabase(data);
}

export function loadCalibration(): CalibrationData {
  const data = localStorage.getItem(STORAGE_KEYS.CALIBRATION);
  return data ? JSON.parse(data) : { ...DEFAULT_CALIBRATION };
}

// --- Settings ---
export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  pushSettingsToSupabase(settings);
}

export function loadSettings(): AppSettings {
  const settings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  return settings ? JSON.parse(settings) : { ...DEFAULT_SETTINGS };
}

// --- Stats & Gamification ---
export function loadUserStats(): UserStats {
  const statsStr = localStorage.getItem(STORAGE_KEYS.STATS);
  const defaultStats: UserStats = {
    xp: 0,
    level: 1,
    streak: 0,
    lastSessionDate: null,
    totalStudyTime: 0,
    badges: [],
    petXp: 0,
    petLevel: 1,
    petGoodPostureStreak: 0,
    coins: 0,
    unlockedItems: [],
    equippedItems: {},
  };
  if (!statsStr) return defaultStats;
  
  let stats;
  try {
    const decrypted = decryptData(statsStr);
    if (decrypted) {
      stats = decrypted;
    } else {
      stats = JSON.parse(statsStr); // fallback
    }
  } catch {
    stats = {};
  }
  
  return { ...defaultStats, ...stats };
}

export function saveUserStats(stats: UserStats): void {
  localStorage.setItem(STORAGE_KEYS.STATS, encryptData(stats));
  pushUserStatsToSupabase(stats);
}

// Add XP and level up if threshold met (1000 XP per level)
export function addXP(amount: number): { stats: UserStats; leveledUp: boolean } {
  const stats = loadUserStats();
  const oldLevel = stats.level;
  
  stats.xp += amount;
  
  // Convert XP to Coins (10 XP = 1 Coin)
  const coinsGained = Math.floor(amount / 10);
  stats.coins += coinsGained;
  
  const xpNeeded = stats.level * 1000;
  if (stats.xp >= xpNeeded) {
    stats.xp -= xpNeeded;
    stats.level += 1;
  }
  
  saveUserStats(stats);
  return { stats, leveledUp: stats.level > oldLevel };
}

// Pet Level calculations
export function calculatePetLevel(xp: number): number {
  if (xp >= 5000) return 5;
  if (xp >= 3000) return 4;
  if (xp >= 1500) return 3;
  if (xp >= 500) return 2;
  return 1;
}

export function addPetXP(amount: number): { stats: UserStats; leveledUp: boolean } {
  const stats = loadUserStats();
  const oldLevel = stats.petLevel;
  
  stats.petXp += amount;
  stats.petLevel = calculatePetLevel(stats.petXp);
  
  saveUserStats(stats);
  return { stats, leveledUp: stats.petLevel > oldLevel };
}

// Gamification Shop Functions
export function addCoins(amount: number): UserStats {
  const stats = loadUserStats();
  stats.coins += amount;
  saveUserStats(stats);
  return stats;
}

export function buyItem(itemId: string, cost: number): boolean {
  const stats = loadUserStats();
  if (stats.coins >= cost && !stats.unlockedItems.includes(itemId)) {
    stats.coins -= cost;
    stats.unlockedItems.push(itemId);
    saveUserStats(stats);
    return true;
  }
  return false;
}

export function equipItem(slot: string, itemId: string | null): UserStats {
  const stats = loadUserStats();
  if (itemId === null) {
    delete stats.equippedItems[slot];
  } else if (stats.unlockedItems.includes(itemId)) {
    stats.equippedItems[slot] = itemId;
  }
  saveUserStats(stats);
  return stats;
}

// Unlock a badge
export function unlockBadge(badgeId: string): boolean {
  const stats = loadUserStats();
  if (stats.badges.includes(badgeId)) return false;
  
  stats.badges.push(badgeId);
  saveUserStats(stats);
  return true;
}

// Check and update daily streak
export function checkAndUpdateStreak(): number {
  const stats = loadUserStats();
  const todayStr = new Date().toISOString().split('T')[0];
  
  if (stats.lastSessionDate === todayStr) {
    return stats.streak;
  }
  
  if (stats.lastSessionDate) {
    const lastDate = new Date(stats.lastSessionDate);
    const today = new Date(todayStr);
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      stats.streak += 1;
    } else if (diffDays > 1) {
      stats.streak = 1;
    }
  } else {
    stats.streak = 1;
  }
  
  stats.lastSessionDate = todayStr;
  saveUserStats(stats);
  return stats.streak;
}

// --- Session History ---
export function saveSessionRecord(record: SessionRecord): void {
  const sessions = getSessionRecords();
  sessions.push(record);
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));

  // Push to Supabase
  pushSessionToSupabase(record);

  // Update cumulative user stats
  const stats = loadUserStats();
  stats.totalStudyTime += record.durationMinutes;
  saveUserStats(stats);

  // Check streaks
  checkAndUpdateStreak();
}

export function getSessionRecords(): SessionRecord[] {
  const sessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  return sessions ? JSON.parse(sessions) : [];
}

// Badge lists
export const BADGES: Badge[] = [
  {
    id: 'warrior',
    name: 'Chiến binh Bền bỉ',
    description: 'Hoàn thành buổi học với tỷ lệ ngồi thẳng đứng lớn hơn 80%.',
    unlocked: false,
    icon: 'Shield',
  },
  {
    id: 'knight',
    name: 'Hiệp sĩ Lưng thẳng',
    description: 'Học tập chăm chỉ với số lần cảnh báo tư thế lớn không quá 2 lần.',
    unlocked: false,
    icon: 'Sword',
  },
  {
    id: 'focus_master',
    name: 'Bậc thầy Tập trung',
    description: 'Duy trì học tập 45 phút liên tục mà không có cảnh báo mất tập trung.',
    unlocked: false,
    icon: 'Target',
  },
  {
    id: 'eye_protector',
    name: 'Hiệp sĩ Mắt sáng',
    description: 'Hoàn thành xuất sắc 5 bài tập chớp mắt thư giãn 20-20-20.',
    unlocked: false,
    icon: 'Eye',
  },
];

export function getBadgesStatus(): Badge[] {
  const stats = loadUserStats();
  return BADGES.map(badge => ({
    ...badge,
    unlocked: stats.badges.includes(badge.id),
  }));
}

// --- Realtime Subscriptions ---
export function subscribeToSupabaseChanges(onSettingsChange: (settings: AppSettings) => void) {
  const client = supabase;
  if (!isSupabaseConfigured || !client) return () => {};

  const getUserIdSync = async () => {
    const { data } = await client.auth.getSession();
    return data.session?.user.id;
  };

  let subscription: any;

  getUserIdSync().then((userId) => {
    if (!userId) return;

    subscription = client
      .channel('public:settings')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'settings',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Realtime settings update received:', payload);
          const s = payload.new as any;
          const newSettings: AppSettings = {
            screenDistanceThreshold: s.screen_distance_threshold,
            neckTiltThreshold: s.neck_tilt_threshold,
            shoulderTiltThreshold: s.shoulder_tilt_threshold,
            slouchThreshold: s.slouch_threshold,
            minBlinkRate: s.min_blink_rate,
            maxBlinkRate: s.max_blink_rate,
            sessionBreakInterval: s.session_break_interval,
            eyeExerciseInterval: s.eye_exercise_interval,
            soundAlertEnabled: s.sound_alert_enabled,
          };
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
          onSettingsChange(newSettings);
        }
      )
      .subscribe();
  });

  return () => {
    if (subscription) client.removeChannel(subscription);
  };
}
