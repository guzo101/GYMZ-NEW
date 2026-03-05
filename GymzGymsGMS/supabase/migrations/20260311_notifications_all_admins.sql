-- ============================================================================
-- GYMZ: NOTIFICATIONS VISIBLE TO ALL ADMINS
-- Date: 2026-03-11
-- Ensures the notification system works for ALL admin types:
--   - Gym admins (gym_id set): see their gym's notifications
--   - Gym admins (gym_id NULL, in gym_contacts): see via is_gym_admin
--   - Platform admins (gym_id NULL, no gym): see all notifications
-- ============================================================================

BEGIN;

-- ─── 1. BACKFILL gym_id FOR ADMINS FROM gym_contacts ────────────────────────
-- Any admin in gym_contacts gets gym_id so is_gym_admin() works.
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


-- ─── 2. EXPAND PLATFORM ADMINS POLICY: admin with gym_id NULL sees all ──────
-- Admins with no gym (e.g. platform-level) can see all notifications.
DROP POLICY IF EXISTS "Platform admins manage all notifications" ON public.notifications;
CREATE POLICY "Platform admins manage all notifications"
ON public.notifications
FOR ALL
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin'
  OR (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin')
    AND (SELECT gym_id FROM public.users WHERE id = auth.uid()) IS NULL
  )
)
WITH CHECK (
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin'
  OR (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin')
    AND (SELECT gym_id FROM public.users WHERE id = auth.uid()) IS NULL
  )
);

-- Note: "Gym admins view/manage" policies handle admins WITH gym_id.
-- This policy handles admins WITHOUT gym_id (platform scope).


COMMIT;

NOTIFY pgrst, 'reload schema';
