-- ============================================================================
-- FIX: OAC Profile Completeness Always Showing 0%
-- Root Cause:
--   The `table_onboarding_gym_isolation` policy (from harden_gym_isolation) uses
--   `is_gym_admin()` which only permits role IN ('admin', 'super_admin').
--   Gym owners registered via OAC have role = 'owner', so they are blocked
--   from reading `gym_onboarding_status`. This makes gymOnboardingStatus come
--   back empty, and `completenessScore` falls back to 0.
--
-- Fix:
--   1. Expand `is_gym_admin()` to include the 'owner' role so OAC users pass.
--   2. Add a dedicated SELECT policy on gym_onboarding_status for gym owners
--      (by gym_id match, not role match) so they can always read their own score.
--   3. Backfill the completeness score for all gyms to fix existing stuck 0% values.
-- ============================================================================

-- ─── 1. EXPAND is_gym_admin TO INCLUDE 'owner' ROLE ─────────────────────────
-- Previously: role IN ('admin', 'super_admin')
-- Now:        role IN ('admin', 'super_admin', 'owner')
CREATE OR REPLACE FUNCTION public.is_gym_admin(p_gym_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND gym_id = p_gym_id
        AND role IN ('admin', 'super_admin', 'owner')
    );
$$;

-- ─── 2. RESTORE GYM OWNER READ ACCESS ON gym_onboarding_status ──────────────
-- The hardened policy blocks owners from reading their own onboarding status.
-- Add a plain gym_id-match SELECT policy to guarantee owners can always read it.
DROP POLICY IF EXISTS "Gym owners can read their onboarding status" ON public.gym_onboarding_status;
CREATE POLICY "Gym owners can read their onboarding status"
ON public.gym_onboarding_status FOR SELECT
USING (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()));

-- ─── 3. BACKFILL COMPLETENESS SCORES ─────────────────────────────────────────
-- Recalculate all gyms so any stuck-at-0 scores are corrected immediately.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.gyms LOOP
        PERFORM public.refresh_gym_completeness_score(r.id);
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
