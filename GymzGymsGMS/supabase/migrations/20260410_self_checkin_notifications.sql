-- Migration: Self-check-in notifications for admin popups
-- When members scan gym/event barcodes, admin sees real-time popups (valid/invalid)
-- Date: 2026-04-10

-- ─── 1. self_checkin_notifications table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.self_checkin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    success BOOLEAN NOT NULL,
    reason TEXT NOT NULL,
    member_name TEXT,
    source TEXT NOT NULL CHECK (source IN ('gym', 'event')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_self_checkin_notifications_gym ON public.self_checkin_notifications(gym_id);
CREATE INDEX IF NOT EXISTS idx_self_checkin_notifications_created ON public.self_checkin_notifications(created_at DESC);

ALTER TABLE public.self_checkin_notifications ENABLE ROW LEVEL SECURITY;

-- Admins see their gym's notifications
DROP POLICY IF EXISTS "gym_admins_view_self_checkin_notifications" ON public.self_checkin_notifications;
CREATE POLICY "gym_admins_view_self_checkin_notifications"
    ON public.self_checkin_notifications FOR SELECT
    USING (public.is_gym_admin(gym_id));

-- Members can insert their own attempts (via RPC)
DROP POLICY IF EXISTS "members_insert_self_checkin_notifications" ON public.self_checkin_notifications;
CREATE POLICY "members_insert_self_checkin_notifications"
    ON public.self_checkin_notifications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.self_checkin_notifications IS 'Real-time scan attempts for admin popups when members self-check-in';

-- ─── 2. RPC: Log self-check-in attempt (called by member app) ───────────────
CREATE OR REPLACE FUNCTION public.log_self_checkin_attempt(
    p_success BOOLEAN,
    p_reason TEXT,
    p_gym_id UUID DEFAULT NULL,
    p_event_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_gym_id UUID;
    v_member_name TEXT;
    v_source TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
    END IF;

    -- Resolve gym_id
    IF p_gym_id IS NOT NULL THEN
        v_gym_id := p_gym_id;
    ELSIF p_event_id IS NOT NULL THEN
        SELECT gym_id INTO v_gym_id FROM public.events WHERE id = p_event_id;
        IF v_gym_id IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Event not found');
        END IF;
    ELSE
        -- Fallback: user's gym
        SELECT gym_id INTO v_gym_id FROM public.users WHERE id = v_user_id;
        IF v_gym_id IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Gym not found');
        END IF;
    END IF;

    -- Get member name
    SELECT COALESCE(first_name || ' ' || last_name, first_name, last_name, email, 'Member')
    INTO v_member_name
    FROM public.users WHERE id = v_user_id;

    v_source := CASE WHEN p_event_id IS NOT NULL THEN 'event' ELSE 'gym' END;

    INSERT INTO public.self_checkin_notifications (gym_id, user_id, event_id, success, reason, member_name, source)
    VALUES (v_gym_id, v_user_id, p_event_id, p_success, COALESCE(p_reason, ''), v_member_name, v_source);

    RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_self_checkin_attempt TO authenticated;

-- ─── 3. Enable Realtime ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'self_checkin_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.self_checkin_notifications;
  END IF;
END $$;
