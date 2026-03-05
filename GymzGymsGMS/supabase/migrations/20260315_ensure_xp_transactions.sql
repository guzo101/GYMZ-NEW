-- ============================================================================
-- FIX: relation "public.xp_transactions" does not exist (42P01)
-- ============================================================================
-- get_unified_app_data RPC queries xp_transactions. If the table is missing,
-- DashboardScreen fetch fails. This migration ensures the table exists.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_id ON public.xp_transactions(user_id);
