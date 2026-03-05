-- Fix: Staff page "Unable to load staff members" after promoting a member
-- Root cause: Admins with NULL gym_id in public.users fail is_gym_admin() even when
-- their email is in gym_contacts. Staff also need to see same-gym users for the Staff page.
-- ============================================================================

-- 1. Expand is_gym_admin to check gym_contacts when user's gym_id is NULL
--    (GMS self-heals gymId from gym_contacts on frontend, but RLS runs server-side)
CREATE OR REPLACE FUNCTION public.is_gym_admin(p_gym_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND gym_id = p_gym_id
        AND role IN ('admin', 'super_admin', 'owner')
    )
    OR EXISTS (
        SELECT 1 FROM public.users u
        JOIN public.gym_contacts gc ON lower(gc.email) = lower(u.email) AND gc.gym_id = p_gym_id AND gc.is_active = true
        WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin', 'owner')
    );
$$;

-- 2. Allow staff to see same-gym users (Staff page lists staff for gym)
--    Staff have gym_id set but fail is_gym_admin (role=staff). user_belongs_to_gym fixes this.
DROP POLICY IF EXISTS "table_users_same_gym_select" ON public.users;
CREATE POLICY "table_users_same_gym_select"
ON public.users FOR SELECT
USING (public.user_belongs_to_gym(gym_id));

-- 3. Backfill gym_id for admins/staff with NULL gym_id (from gym_contacts)
--    Ensures future is_gym_admin checks pass without gym_contacts fallback
UPDATE public.users u
SET gym_id = (
  SELECT gc.gym_id FROM public.gym_contacts gc
  WHERE lower(trim(gc.email)) = lower(trim(u.email))
    AND gc.is_active = true
  LIMIT 1
)
WHERE u.gym_id IS NULL
  AND u.role IN ('admin', 'super_admin', 'owner', 'staff')
  AND u.email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.gym_contacts gc
    WHERE lower(trim(gc.email)) = lower(trim(u.email))
      AND gc.is_active = true
  );
