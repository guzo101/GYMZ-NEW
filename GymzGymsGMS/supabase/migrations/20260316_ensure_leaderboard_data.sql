-- ============================================================================
-- FIX: relation "public.leaderboard_data" does not exist (42P01)
-- ============================================================================
-- get_unified_app_data RPC queries leaderboard_data for rank/total_points.
-- ProfileScreen fetchProfileData fails when table is missing.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.leaderboard_data (
  leaderboard_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  weekly_points INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  rank INTEGER,
  calories_logged_count INTEGER DEFAULT 0,
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_data_user_id ON public.leaderboard_data(user_id);
