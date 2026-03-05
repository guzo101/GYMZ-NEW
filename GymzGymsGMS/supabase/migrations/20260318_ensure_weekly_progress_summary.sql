-- ============================================================================
-- FIX: relation "public.weekly_progress_summary" does not exist (42P01)
-- ============================================================================
-- get_unified_app_data RPC queries weekly_progress_summary for weekly_count.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.weekly_progress_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  week_start_date DATE NOT NULL,
  total_workouts INTEGER DEFAULT 0,
  total_workout_duration INTEGER DEFAULT 0,
  avg_daily_calories NUMERIC DEFAULT 0,
  avg_weight NUMERIC,
  total_calories_logged INTEGER DEFAULT 0,
  total_classes_attended INTEGER DEFAULT 0,
  total_xp_earned INTEGER DEFAULT 0,
  total_volume_lifted NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_summary_user_week ON public.weekly_progress_summary(user_id, week_start_date DESC);
