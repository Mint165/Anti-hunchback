// Local Storage / Database Service for Posture Health App

import type { CalibrationData } from './postureAI';
import { DEFAULT_CALIBRATION } from './postureAI';

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
}

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  lastSessionDate: string | null;
  totalStudyTime: number; // minutes
  badges: string[]; // unlocked badge ids
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

// --- Calibration ---
export function saveCalibration(data: CalibrationData): void {
  localStorage.setItem(STORAGE_KEYS.CALIBRATION, JSON.stringify(data));
}

export function loadCalibration(): CalibrationData {
  const data = localStorage.getItem(STORAGE_KEYS.CALIBRATION);
  return data ? JSON.parse(data) : { ...DEFAULT_CALIBRATION };
}

// --- Settings ---
export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function loadSettings(): AppSettings {
  const settings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  return settings ? JSON.parse(settings) : { ...DEFAULT_SETTINGS };
}

// --- Stats & Gamification ---
export function loadUserStats(): UserStats {
  const stats = localStorage.getItem(STORAGE_KEYS.STATS);
  const defaultStats: UserStats = {
    xp: 0,
    level: 1,
    streak: 0,
    lastSessionDate: null,
    totalStudyTime: 0,
    badges: [],
  };
  return stats ? JSON.parse(stats) : defaultStats;
}

export function saveUserStats(stats: UserStats): void {
  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
}

// Add XP and level up if threshold met (1000 XP per level)
export function addXP(amount: number): { stats: UserStats; leveledUp: boolean } {
  const stats = loadUserStats();
  const oldLevel = stats.level;
  
  stats.xp += amount;
  
  // Exponential or simple level up (e.g. 1000 XP per level)
  const xpNeeded = stats.level * 1000;
  if (stats.xp >= xpNeeded) {
    stats.xp -= xpNeeded;
    stats.level += 1;
  }
  
  saveUserStats(stats);
  return { stats, leveledUp: stats.level > oldLevel };
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
      stats.streak = 1; // streak reset but counts as 1 for today
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
