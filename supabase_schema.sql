-- Supabase Database Schema for Anti-Hunchback (Multi-tenant)
-- Copy and paste this into the SQL Editor of your Supabase project (https://supabase.com)

-- 0. Clean old tables to ensure fresh setup
DROP TABLE IF EXISTS calibration, settings, user_stats, sessions CASCADE;

-- 1. Create Calibration Table
CREATE TABLE calibration (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    base_eye_distance INT NOT NULL,
    base_neck_y_offset INT NOT NULL,
    base_shoulder_y_diff INT NOT NULL,
    base_torso_height INT NOT NULL,
    base_ear FLOAT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Settings Table
CREATE TABLE settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE TABLE user_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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

-- Create Index on Sessions Date and user_id to optimize queries
CREATE INDEX idx_sessions_user_date ON sessions(user_id, date);

-- Enable Row Level Security (RLS)
ALTER TABLE calibration ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for Calibration
CREATE POLICY "Users can manage their own calibration data" 
ON calibration FOR ALL 
USING (auth.uid() = user_id);

-- Create RLS Policies for Settings
CREATE POLICY "Users can manage their own settings data" 
ON settings FOR ALL 
USING (auth.uid() = user_id);

-- Create RLS Policies for User Stats
CREATE POLICY "Users can manage their own user_stats data" 
ON user_stats FOR ALL 
USING (auth.uid() = user_id);

-- Create RLS Policies for Sessions
CREATE POLICY "Users can manage their own sessions data" 
ON sessions FOR ALL 
USING (auth.uid() = user_id);

-- Note: The frontend will automatically handle inserting initial default rows using "upsert" on first login/save.
