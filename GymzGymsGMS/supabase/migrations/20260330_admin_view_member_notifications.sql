-- ============================================================================
-- GYMZ: Admins can view notifications sent to members (in-app, payment reminders, etc.)
-- Date: 2026-03-30
-- Enables "Sent Notifications" section: payment reminders, push, viewed status.
-- ============================================================================

BEGIN;

-- Admins can SELECT notifications sent TO members (user_id IS NOT NULL) when the
-- member belongs to their gym. Used for "Sent Notifications" / "Member Notifications" page.
DROP POLICY IF EXISTS "Gym admins view member notifications for their gym" ON public.notifications;
CREATE POLICY "Gym admins view member notifications for their gym"
  ON public.notifications FOR SELECT
  USING (
    user_id IS NOT NULL
    AND public.is_gym_admin(COALESCE(gym_id, (SELECT gym_id FROM public.users WHERE id = user_id)))
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
