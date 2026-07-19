export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      calibration: {
        Row: {
          user_id: string
          base_eye_distance: number
          base_neck_y_offset: number
          base_shoulder_y_diff: number
          base_torso_height: number
          base_ear: number
          updated_at: string
        }
        Insert: {
          user_id: string
          base_eye_distance: number
          base_neck_y_offset: number
          base_shoulder_y_diff: number
          base_torso_height: number
          base_ear: number
          updated_at?: string
        }
        Update: {
          user_id?: string
          base_eye_distance?: number
          base_neck_y_offset?: number
          base_shoulder_y_diff?: number
          base_torso_height?: number
          base_ear?: number
          updated_at?: string
        }
      }
      settings: {
        Row: {
          user_id: string
          screen_distance_threshold: number
          neck_tilt_threshold: number
          shoulder_tilt_threshold: number
          slouch_threshold: number
          min_blink_rate: number
          max_blink_rate: number
          session_break_interval: number
          eye_exercise_interval: number
          sound_alert_enabled: boolean
          updated_at: string
        }
        Insert: {
          user_id: string
          screen_distance_threshold: number
          neck_tilt_threshold: number
          shoulder_tilt_threshold: number
          slouch_threshold: number
          min_blink_rate: number
          max_blink_rate: number
          session_break_interval: number
          eye_exercise_interval: number
          sound_alert_enabled: boolean
          updated_at?: string
        }
        Update: {
          user_id?: string
          screen_distance_threshold?: number
          neck_tilt_threshold?: number
          shoulder_tilt_threshold?: number
          slouch_threshold?: number
          min_blink_rate?: number
          max_blink_rate?: number
          session_break_interval?: number
          eye_exercise_interval?: number
          sound_alert_enabled?: boolean
          updated_at?: string
        }
      }
      user_stats: {
        Row: {
          user_id: string
          xp: number
          level: number
          streak: number
          last_session_date: string | null
          total_study_time: number
          badges: string[]
          coins: number
          unlocked_items: string[]
          equipped_items: Json
          updated_at: string
        }
        Insert: {
          user_id: string
          xp?: number
          level?: number
          streak?: number
          last_session_date?: string | null
          total_study_time?: number
          badges?: string[]
          coins?: number
          unlocked_items?: string[]
          equipped_items?: Json
          updated_at?: string
        }
        Update: {
          user_id?: string
          xp?: number
          level?: number
          streak?: number
          last_session_date?: string | null
          total_study_time?: number
          badges?: string[]
          coins?: number
          unlocked_items?: string[]
          equipped_items?: Json
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          date: string
          start_time: number
          end_time: number
          duration_minutes: number
          average_health_score: number
          good_posture_percentage: number
          warnings_count: number
          blinks_count: number
          fidget_flags_count: number
          completed_eye_exercises: number
          streak_added: boolean
          created_at: string
        }
        Insert: {
          id: string
          user_id: string
          date: string
          start_time: number
          end_time: number
          duration_minutes: number
          average_health_score: number
          good_posture_percentage: number
          warnings_count: number
          blinks_count: number
          fidget_flags_count: number
          completed_eye_exercises: number
          streak_added: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          start_time?: number
          end_time?: number
          duration_minutes?: number
          average_health_score?: number
          good_posture_percentage?: number
          warnings_count?: number
          blinks_count?: number
          fidget_flags_count?: number
          completed_eye_exercises?: number
          streak_added?: boolean
          created_at?: string
        }
      }
    }
  }
}
