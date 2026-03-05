-- ============================================================================
-- FIX: Gyms Table RLS + App Visibility
-- Problems:
--   1. Draft gyms are visible in the app (no RLS filter on public reads)
--   2. Activation from OAC may silently fail if the gyms UPDATE policy
--      doesn't exist or doesn't cover platform_admin correctly
-- ============================================================================

-- ─── 1. ENSURE RLS IS ON ─────────────────────────────────────────────────────
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

-- ─── 2. DROP OLD CONFLICTING POLICIES ────────────────────────────────────────
DROP POLICY IF EXISTS "Platform admins have full access to gyms" ON public.gyms;
DROP POLICY IF EXISTS "Gym owners can view their own gym" ON public.gyms;
DROP POLICY IF EXISTS "Public can read active gyms" ON public.gyms;

-- ─── 3. PLATFORM ADMINS: FULL ACCESS (read + write all gyms) ─────────────────
CREATE POLICY "Platform admins have full access to gyms"
ON public.gyms FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- ─── 4. GYM OWNERS/ADMINS: READ THEIR OWN GYM (any status) ──────────────────
CREATE POLICY "Gym owners can view their own gym"
ON public.gyms FOR SELECT
USING (id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()));

-- ─── 5. PUBLIC / APP: ONLY ACTIVE GYMS ───────────────────────────────────────
-- This is what the GymSelectionScreen relies on (.eq('status', 'active'))
-- Without this, unauthenticated or member users would see draft gyms too.
CREATE POLICY "Public can read active gyms"
ON public.gyms FOR SELECT
USING (status = 'active');

NOTIFY pgrst, 'reload schema';
