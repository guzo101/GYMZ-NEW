-- ============================================================================
-- GYMZ: Join notifications schema extension + dedupe + one-per-admin
-- Date: 2026-03-29
-- Extends notifications for: backfill, dedupe, metadata, recipient_admin_id.
-- ============================================================================

BEGIN;

-- ─── 1. ADD COLUMNS TO NOTIFICATIONS ───────────────────────────────────────
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_backfilled BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS recipient_admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;

-- Unique constraint on dedupe_key (nullable for non-join notifications)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_key
  ON public.notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- ─── 2. FUNCTION: Get admin user IDs for a gym ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_gym_admin_ids(p_gym_id UUID)
RETURNS TABLE (admin_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.role IN ('admin', 'super_admin', 'owner')
    AND (
      u.gym_id = p_gym_id
      OR EXISTS (
        SELECT 1 FROM public.gym_contacts gc
        WHERE lower(trim(gc.email)) = lower(trim(u.email))
          AND gc.gym_id = p_gym_id
          AND gc.is_active = true
      )
    );
$$;

-- ─── 3. UPDATE RLS: Admins see/manage notifications for their gym ───────────
-- Include recipient_admin_id: show if (recipient_admin_id IS NULL OR recipient_admin_id = auth.uid())
DROP POLICY IF EXISTS "Gym admins view their gym notifications" ON public.notifications;
CREATE POLICY "Gym admins view their gym notifications"
  ON public.notifications FOR SELECT
  USING (
    public.is_gym_admin(gym_id)
    AND (recipient_admin_id IS NULL OR recipient_admin_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gym admins manage their gym notifications" ON public.notifications;
CREATE POLICY "Gym admins manage their gym notifications"
  ON public.notifications FOR UPDATE
  USING (
    (public.is_gym_admin(gym_id) OR auth.jwt() ->> 'role' = 'service_role')
    AND (recipient_admin_id IS NULL OR recipient_admin_id = auth.uid())
  )
  WITH CHECK (
    (public.is_gym_admin(gym_id) OR auth.jwt() ->> 'role' = 'service_role')
    AND (recipient_admin_id IS NULL OR recipient_admin_id = auth.uid())
  );

-- ─── 4. HELPER: Insert join notification (one per admin, with dedupe) ───────
CREATE OR REPLACE FUNCTION public.insert_join_notification(
  p_gym_id UUID,
  p_join_type TEXT,  -- 'member_joined_gym' | 'member_joined_event'
  p_member_user_id UUID,
  p_member_name TEXT,
  p_member_assigned_id TEXT,
  p_join_record_id UUID,
  p_event_id UUID DEFAULT NULL,
  p_event_title TEXT DEFAULT NULL,
  p_created_at TIMESTAMPTZ DEFAULT NOW(),
  p_is_backfilled BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
  v_dedupe TEXT;
  v_message TEXT;
  v_metadata JSONB;
  v_gym_name TEXT;
  v_inserted_count INT := 0;
BEGIN
  SELECT name INTO v_gym_name FROM public.gyms WHERE id = p_gym_id;
  v_gym_name := COALESCE(v_gym_name, 'Gym');

  IF p_join_type = 'member_joined_gym' THEN
    v_message := p_member_name || ' joined ' || v_gym_name || ' (Gym) • ID: ' || COALESCE(p_member_assigned_id, '—');
    v_metadata := jsonb_build_object(
      'member_id', p_member_user_id,
      'user_id', p_member_user_id,
      'membership_type', 'gym_access',
      'join_source_path', 'gym',
      'join_record_id', p_join_record_id
    );
  ELSE
    v_message := p_member_name || ' signed up for ' || COALESCE(p_event_title, 'Event') || ' at ' || v_gym_name || ' • ID: ' || COALESCE(p_member_assigned_id, '—');
    v_metadata := jsonb_build_object(
      'member_id', p_member_user_id,
      'user_id', p_member_user_id,
      'event_id', p_event_id,
      'join_source_path', 'event',
      'join_record_id', p_join_record_id
    );
  END IF;

  FOR v_admin IN SELECT admin_id FROM public.get_gym_admin_ids(p_gym_id)
  LOOP
    IF p_join_type = 'member_joined_gym' THEN
      v_dedupe := 'join_gym:' || p_gym_id || ':' || p_member_user_id || ':' || p_join_record_id || ':' || v_admin.admin_id;
    ELSE
      v_dedupe := 'join_event:' || p_gym_id || ':' || p_member_user_id || ':' || COALESCE(p_event_id::TEXT, '') || ':' || p_join_record_id || ':' || v_admin.admin_id;
    END IF;

    INSERT INTO public.notifications (
      user_id, gym_id, recipient_admin_id, type, message, title, metadata,
      dedupe_key, is_backfilled, created_at, priority, is_read, status,
      action_url, action_label
    ) VALUES (
      NULL,
      p_gym_id,
      v_admin.admin_id,
      p_join_type,
      v_message,
      CASE WHEN p_join_type = 'member_joined_gym' THEN 'New Gym Member' ELSE 'New Event Sign-up' END,
      v_metadata,
      v_dedupe,
      p_is_backfilled,
      p_created_at,
      3,
      FALSE,
      'unread',
      CASE WHEN p_join_type = 'member_joined_gym' THEN '/members?search=' || p_member_user_id ELSE '/admin/event-rsvps' END,
      CASE WHEN p_join_type = 'member_joined_gym' THEN 'View Member' ELSE 'View Sign-ups' END
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  -- If no admins found, insert one with recipient_admin_id=NULL (visible to future admins)
  IF v_inserted_count = 0 THEN
    IF p_join_type = 'member_joined_gym' THEN
      v_dedupe := 'join_gym:' || p_gym_id || ':' || p_member_user_id || ':' || p_join_record_id || ':fallback';
    ELSE
      v_dedupe := 'join_event:' || p_gym_id || ':' || p_member_user_id || ':' || COALESCE(p_event_id::TEXT, '') || ':' || p_join_record_id || ':fallback';
    END IF;

    INSERT INTO public.notifications (
      user_id, gym_id, recipient_admin_id, type, message, title, metadata,
      dedupe_key, is_backfilled, created_at, priority, is_read, status,
      action_url, action_label
    ) VALUES (
      NULL,
      p_gym_id,
      NULL,
      p_join_type,
      v_message,
      CASE WHEN p_join_type = 'member_joined_gym' THEN 'New Gym Member' ELSE 'New Event Sign-up' END,
      v_metadata,
      v_dedupe,
      p_is_backfilled,
      p_created_at,
      3,
      FALSE,
      'unread',
      CASE WHEN p_join_type = 'member_joined_gym' THEN '/members?search=' || p_member_user_id ELSE '/admin/event-rsvps' END,
      CASE WHEN p_join_type = 'member_joined_gym' THEN 'View Member' ELSE 'View Sign-ups' END
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;
END;
$$;

-- ─── 5. UPDATE TRIGGERS TO USE insert_join_notification ────────────────────

-- Gym path: membership becomes active
CREATE OR REPLACE FUNCTION public.notify_admin_on_membership_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_member_id TEXT;
  v_is_new BOOLEAN := FALSE;
BEGIN
  IF NEW.membership_status = 'active' THEN
    IF TG_OP = 'INSERT' THEN
      v_is_new := TRUE;
    ELSIF TG_OP = 'UPDATE' AND (OLD.membership_status IS NULL OR OLD.membership_status != 'active') THEN
      v_is_new := TRUE;
    END IF;

    IF v_is_new AND NEW.access_mode = 'gym_access' THEN
      SELECT COALESCE(u.name, u.first_name, split_part(u.email, '@', 1), 'New Member')
        INTO v_name FROM public.users u WHERE u.id = NEW.user_id;
      v_member_id := COALESCE(NEW.unique_member_id, (SELECT unique_id FROM public.users WHERE id = NEW.user_id), '—');

      PERFORM public.insert_join_notification(
        NEW.gym_id,
        'member_joined_gym',
        NEW.user_id,
        v_name,
        v_member_id,
        NEW.id,
        NULL,
        NULL,
        NEW.created_at,
        false
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Event path: user gets gym_id with event_access
CREATE OR REPLACE FUNCTION public.notify_admin_on_member_gym_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_member_id TEXT;
BEGIN
  IF (OLD.gym_id IS NULL AND NEW.gym_id IS NOT NULL)
     AND (NEW.role = 'member' OR NEW.role IS NULL)
     AND COALESCE(NEW.access_mode, 'gym_access') = 'event_access'
  THEN
    v_name := COALESCE(NEW.name, NEW.first_name, split_part(NEW.email, '@', 1), 'New Member');
    v_member_id := COALESCE(NEW.unique_id, '—');

    PERFORM public.insert_join_notification(
      NEW.gym_id,
      'member_joined_event',
      NEW.id,
      v_name,
      v_member_id,
      NEW.id,
      NULL,
      'Event Access',
      NOW(),
      false
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Event path: event RSVP
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
  v_member_id TEXT;
BEGIN
  IF NEW.status IN ('confirmed', 'waitlisted') THEN
    SELECT e.gym_id, e.title INTO v_gym_id, v_event_title
      FROM public.events e WHERE e.id = NEW.event_id;

    IF v_gym_id IS NOT NULL THEN
      SELECT u.name, u.unique_id INTO v_member_name, v_member_id
        FROM public.users u WHERE u.id = NEW.user_id;
      v_member_name := COALESCE(v_member_name, 'A member');
      v_member_id := COALESCE(v_member_id, '—');
      v_event_title := COALESCE(v_event_title, 'Event');

      PERFORM public.insert_join_notification(
        v_gym_id,
        'member_joined_event',
        NEW.user_id,
        v_member_name,
        v_member_id,
        NEW.id,
        NEW.event_id,
        v_event_title,
        NEW.created_at,
        false
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
