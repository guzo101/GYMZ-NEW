-- ============================================================================
-- GYMZ: Admin notifications on every member join (Gym + Event paths)
-- Date: 2026-03-28
-- Fix: Admins were not notified when new members joined.
-- Root cause: Triggers run in invoker context; RLS blocked INSERT when members
-- updated their profile or RSVP'd. Also missing notification for gym path joins.
-- ============================================================================

BEGIN;

-- ─── 1. RLS: Allow members to insert admin notifications for their gym ──────
-- Triggers fire in the session of the user who made the change (member).
-- Without this, notify_admin_on_member_gym_join and notify_admin_on_event_signup
-- would fail RLS when a member updates gym_id or inserts event_rsvp.
DROP POLICY IF EXISTS "Gym admins insert their gym notifications" ON public.notifications;
CREATE POLICY "Gym admins insert their gym notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR (auth.uid() = user_id AND public.has_valid_member_id())
    OR (public.is_gym_admin(gym_id) AND gym_id IS NOT NULL)
    OR (user_id IS NOT NULL AND public.is_gym_admin(
        (SELECT gym_id FROM public.users WHERE id = user_id)
    ))
    -- Members can create admin notifications (user_id=NULL) for gyms they belong to
    OR (
        user_id IS NULL
        AND gym_id IS NOT NULL
        AND (
            EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.id = auth.uid() AND u.gym_id = gym_id
            )
            OR EXISTS (
                SELECT 1 FROM public.event_rsvps er
                WHERE er.user_id = auth.uid() AND er.gym_id = gym_id
            )
            OR EXISTS (
                SELECT 1 FROM public.membership m
                WHERE m.user_id = auth.uid() AND m.gym_id = gym_id
            )
        )
    )
);


-- ─── 2. TRIGGER: Notify admins when membership becomes active (Gym path) ────
-- Gym path: user pays → admin approves → membership becomes active.
-- This is the definitive "join" for gym_access. One notification per new active membership.
CREATE OR REPLACE FUNCTION public.notify_admin_on_membership_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_gym_name TEXT;
  v_member_id TEXT;
  v_is_new BOOLEAN := FALSE;
BEGIN
  -- Only when membership becomes active (new or transition from pending)
  IF NEW.membership_status = 'active' THEN
    IF TG_OP = 'INSERT' THEN
      v_is_new := TRUE;
    ELSIF TG_OP = 'UPDATE' AND (OLD.membership_status IS NULL OR OLD.membership_status != 'active') THEN
      v_is_new := TRUE;
    END IF;

    IF v_is_new AND NEW.access_mode = 'gym_access' THEN
      SELECT COALESCE(u.name, u.first_name, split_part(u.email, '@', 1), 'New Member')
        INTO v_name FROM public.users u WHERE u.id = NEW.user_id;
      SELECT g.name INTO v_gym_name FROM public.gyms g WHERE g.id = NEW.gym_id;
      v_gym_name := COALESCE(v_gym_name, 'Gym');
      v_member_id := COALESCE(NEW.unique_member_id, (SELECT unique_id FROM public.users WHERE id = NEW.user_id), '—');

      INSERT INTO public.notifications (
        user_id, gym_id, type, message, priority, is_read, status, action_url, action_label
      ) VALUES (
        NULL,
        NEW.gym_id,
        'member_signup',
        v_name || ' joined ' || v_gym_name || ' (Gym) • ID: ' || v_member_id,
        3,
        FALSE,
        'unread',
        '/members?search=' || NEW.user_id,
        'View Member'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_on_membership_active ON public.membership;
CREATE TRIGGER trg_notify_admin_on_membership_active
  AFTER INSERT OR UPDATE OF membership_status ON public.membership
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_membership_active();


-- ─── 3. TRIGGER: Notify admins when user gets gym_id (Event path join) ──────
-- Event path: user selects event_access → gym_id set. Only for event_access to avoid
-- duplicate with membership trigger (gym_access users get notified on approval).
CREATE OR REPLACE FUNCTION public.notify_admin_on_member_gym_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_gym_name TEXT;
  v_member_id TEXT;
BEGIN
  IF (OLD.gym_id IS NULL AND NEW.gym_id IS NOT NULL)
     AND (NEW.role = 'member' OR NEW.role IS NULL)
     AND COALESCE(NEW.access_mode, 'gym_access') = 'event_access'
  THEN
    v_name := COALESCE(NEW.name, NEW.first_name, split_part(NEW.email, '@', 1), 'New Member');
    SELECT g.name INTO v_gym_name FROM public.gyms g WHERE g.id = NEW.gym_id;
    v_gym_name := COALESCE(v_gym_name, 'Gym');
    v_member_id := COALESCE(NEW.unique_id, '—');

    INSERT INTO public.notifications (
      user_id, gym_id, type, message, priority, is_read, status, action_url, action_label
    ) VALUES (
      NULL,
      NEW.gym_id,
      'member_signup',
      v_name || ' joined ' || v_gym_name || ' (Event) • ID: ' || v_member_id,
      3,
      FALSE,
      'unread',
      '/members?search=' || NEW.id,
      'View Member'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_on_member_gym_join ON public.users;
CREATE TRIGGER trg_notify_admin_on_member_gym_join
  AFTER UPDATE OF gym_id ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_member_gym_join();


-- ─── 4. TRIGGER: Notify admins on event RSVP (Event path) ────────────────────
-- Enhanced with member name, event title, gym name, event ID.
CREATE OR REPLACE FUNCTION public.notify_admin_on_event_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gym_id UUID;
  v_gym_name TEXT;
  v_event_title TEXT;
  v_member_name TEXT;
  v_member_id TEXT;
BEGIN
  IF NEW.status IN ('confirmed', 'waitlisted') THEN
    SELECT e.gym_id, e.title, g.name
      INTO v_gym_id, v_event_title, v_gym_name
      FROM public.events e
      LEFT JOIN public.gyms g ON g.id = e.gym_id
      WHERE e.id = NEW.event_id;

    IF v_gym_id IS NOT NULL THEN
      SELECT u.name, u.unique_id
        INTO v_member_name, v_member_id
        FROM public.users u WHERE u.id = NEW.user_id;
      v_member_name := COALESCE(v_member_name, 'A member');
      v_member_id := COALESCE(v_member_id, '—');
      v_gym_name := COALESCE(v_gym_name, 'Gym');
      v_event_title := COALESCE(v_event_title, 'Event');

      INSERT INTO public.notifications (
        user_id, gym_id, type, message, priority, is_read, status, action_url, action_label
      ) VALUES (
        NULL,
        v_gym_id,
        'event_signup',
        v_member_name || ' signed up for ' || v_event_title || ' at ' || v_gym_name || ' • ID: ' || v_member_id,
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


-- ─── 5. handle_new_user: Ensure member_signup when gym_id at signup ──────────
-- Users who sign up with gym_id in metadata (invite flow) get one notification here.
-- 20260309 already has this; we ensure it's still present (no overwrite).
-- (handle_new_user is defined in 20260309; we don't modify it here to avoid
--  migration ordering issues. The triggers above cover deferred-join flows.)


COMMIT;

NOTIFY pgrst, 'reload schema';
