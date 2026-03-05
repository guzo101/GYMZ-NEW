-- ============================================================================
-- FIX: relation "public.workout_sessions" does not exist (42P01)
-- ============================================================================
-- get_unified_app_data RPC queries workout_sessions for workout_count/today_minutes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workout_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  sets INTEGER,
  reps INTEGER,
  weight NUMERIC,
  duration INTEGER,
  intensity_level TEXT,
  form_score INTEGER CHECK (form_score BETWEEN 0 AND 100),
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id ON public.workout_sessions(user_id);
