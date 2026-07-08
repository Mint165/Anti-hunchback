-- Supabase Database Schema for Anti-Hunchback (Oliver)
-- Copy and paste this into the SQL Editor of your Supabase project (https://supabase.com)

-- 1. Create Calibration Table
CREATE TABLE IF NOT EXISTS calibration (
    id TEXT PRIMARY KEY DEFAULT 'default',
    base_eye_distance INT NOT NULL,
    base_neck_y_offset INT NOT NULL,
    base_shoulder_y_diff INT NOT NULL,
    base_torso_height INT NOT NULL,
    base_ear FLOAT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    screen_distance_threshold INT NOT NULL,
    neck_tilt_threshold INT NOT NULL,
    shoulder_tilt_threshold INT NOT NULL,
    slouch_threshold INT NOT NULL,
    min_blink_rate INT NOT NULL,
    max_blink_rate INT NOT NULL,
    session_break_interval INT NOT NULL,
    eye_exercise_interval INT NOT NULL,
    sound_alert_enabled BOOLEAN NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create User Stats Table
CREATE TABLE IF NOT EXISTS user_stats (
    id TEXT PRIMARY KEY DEFAULT 'default',
    xp INT NOT NULL DEFAULT 0,
    level INT NOT NULL DEFAULT 1,
    streak INT NOT NULL DEFAULT 0,
    last_session_date TEXT,
    total_study_time INT NOT NULL DEFAULT 0,
    badges TEXT[] NOT NULL DEFAULT '{}',
    coins INT NOT NULL DEFAULT 0,
    unlocked_items TEXT[] NOT NULL DEFAULT '{}',
    equipped_items JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    start_time BIGINT NOT NULL,
    end_time BIGINT NOT NULL,
    duration_minutes INT NOT NULL,
    average_health_score INT NOT NULL,
    good_posture_percentage INT NOT NULL,
    warnings_count INT NOT NULL,
    blinks_count INT NOT NULL,
    fidget_flags_count INT NOT NULL,
    completed_eye_exercises INT NOT NULL,
    streak_added BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Index on Sessions Date to optimize queries
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);

-- Disable Row Level Security (RLS) for simple setup (or configure public RLS policies)
ALTER TABLE calibration DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;

-- Seed default calibration data
INSERT INTO calibration (id, base_eye_distance, base_neck_y_offset, base_shoulder_y_diff, base_torso_height, base_ear)
VALUES ('default', 80, 120, 0, 180, 0.28)
ON CONFLICT (id) DO NOTHING;

-- Seed default settings data
INSERT INTO settings (id, screen_distance_threshold, neck_tilt_threshold, shoulder_tilt_threshold, slouch_threshold, min_blink_rate, max_blink_rate, session_break_interval, eye_exercise_interval, sound_alert_enabled)
VALUES ('default', 50, 20, 7, 15, 4, 25, 45, 20, true)
ON CONFLICT (id) DO NOTHING;

-- Seed default user stats data
INSERT INTO user_stats (id, xp, level, streak, last_session_date, total_study_time, badges)
VALUES ('default', 0, 1, 0, null, 0, '{}')
ON CONFLICT (id) DO NOTHING;
