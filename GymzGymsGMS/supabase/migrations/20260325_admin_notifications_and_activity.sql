-- ============================================================================
-- Admin notifications for all changes + Recent Activity sync
-- Date: 2026-03-25
-- Ensures admins get notified when: new members join, event signups, etc.
-- ============================================================================

BEGIN;

-- ─── 1. TRIGGER: Notify admins when user gets gym_id (member joins gym) ─────
-- Covers flow where user selects gym AFTER signup (e.g. GymSelection → AccessModeSelection)
CREATE OR REPLACE FUNCTION public.notify_admin_on_member_gym_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_role TEXT;
BEGIN
  -- Only when gym_id changes from NULL to a value (new gym assignment)
  IF (OLD.gym_id IS NULL AND NEW.gym_id IS NOT NULL)
     AND (NEW.role = 'member' OR NEW.role IS NULL)
  THEN
    v_name := COALESCE(NEW.name, NEW.first_name, split_part(NEW.email, '@', 1), 'New Member');
    v_role := COALESCE(NEW.role, 'member');

    IF v_role = 'member' THEN
      INSERT INTO public.notifications (
        user_id, gym_id, type, message, priority, is_read, status, action_url, action_label
      ) VALUES (
        NULL,
        NEW.gym_id,
        'member_signup',
        'New member registered: ' || v_name,
        3,
        FALSE,
        'unread',
        '/members?search=' || NEW.id,
        'View Member'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_on_member_gym_join ON public.users;
CREATE TRIGGER trg_notify_admin_on_member_gym_join
  AFTER UPDATE OF gym_id ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_member_gym_join();


-- ─── 2. TRIGGER: Notify admins when someone signs up for an event ───────────
CREATE OR REPLACE FUNCTION public.notify_admin_on_event_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gym_id UUID;
  v_event_title TEXT;
  v_member_name TEXT;
BEGIN
  IF NEW.status IN ('confirmed', 'waitlisted') THEN
    SELECT e.gym_id, e.title INTO v_gym_id, v_event_title
    FROM public.events e WHERE e.id = NEW.event_id;

    IF v_gym_id IS NOT NULL THEN
      SELECT name INTO v_member_name FROM public.users WHERE id = NEW.user_id;
      v_member_name := COALESCE(v_member_name, 'A member');

      INSERT INTO public.notifications (
        user_id, gym_id, type, message, priority, is_read, status, action_url, action_label
      ) VALUES (
        NULL,
        v_gym_id,
        'event_signup',
        v_member_name || ' signed up for: ' || COALESCE(v_event_title, 'Event'),
        3,
        FALSE,
        'unread',
        '/admin/event-rsvps',
        'View Sign-ups'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_on_event_signup ON public.event_rsvps;
CREATE TRIGGER trg_notify_admin_on_event_signup
  AFTER INSERT ON public.event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_event_signup();


COMMIT;

NOTIFY pgrst, 'reload schema';
