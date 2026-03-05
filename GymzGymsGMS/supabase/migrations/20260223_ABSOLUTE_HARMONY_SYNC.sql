-- ============================================================================
-- GYMZ ABSOLUTE HARMONY: SSOT SYNC & NORMALIZATION
-- Date: 2026-02-23
-- Purpose: Harmonize goal fields, normalize statuses, and harden RPCs.
-- ============================================================================

BEGIN;

-- 1. HARMONIZE GOAL FIELDS (goal <-> primary_objective)
-- This ensures the App (goal) and GMS (primary_objective) stay in sync.
CREATE OR REPLACE FUNCTION public.sync_user_goal_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- If goal is updated, sync to primary_objective
    IF (TG_OP = 'UPDATE' AND OLD.goal IS DISTINCT FROM NEW.goal) OR (TG_OP = 'INSERT' AND NEW.goal IS NOT NULL) THEN
        NEW.primary_objective := NEW.goal;
    -- If primary_objective is updated, sync to goal
    ELSIF (TG_OP = 'UPDATE' AND OLD.primary_objective IS DISTINCT FROM NEW.primary_objective) OR (TG_OP = 'INSERT' AND NEW.primary_objective IS NOT NULL) THEN
        NEW.goal := NEW.primary_objective;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_goal_fields ON public.users;
CREATE TRIGGER trg_sync_user_goal_fields
BEFORE INSERT OR UPDATE OF goal, primary_objective ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_goal_fields();

-- 2. CASE NORMALIZATION (Payments & Membership Status)
-- Force lowercase for all statuses to prevent UI filter desyncs.
UPDATE public.payments SET status = LOWER(status) WHERE status IS NOT NULL;
UPDATE public.users SET membership_status = LOWER(membership_status) WHERE membership_status IS NOT NULL;

-- 3. HARDEN RPC PERMISSIONS
-- Ensure the unified data fetcher is executable and secure.
GRANT EXECUTE ON FUNCTION public.get_unified_app_data(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unified_app_data(UUID, DATE) TO service_role;

-- 4. BACKFILL: Ensure existing users have synced goals
UPDATE public.users 
SET goal = COALESCE(goal, primary_objective),
    primary_objective = COALESCE(primary_objective, goal)
WHERE goal IS DISTINCT FROM primary_objective;

COMMIT;
