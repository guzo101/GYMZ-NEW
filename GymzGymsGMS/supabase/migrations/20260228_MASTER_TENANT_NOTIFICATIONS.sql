-- ============================================================================
-- GYMZ MASTER DEPLOYMENT SCRIPT: TENANT NOTIFICATIONS & DATA MAPPING
-- Date: 2026-02-28
-- Resolves: Gym owners not receiving signup/payment notifications.
-- ============================================================================

BEGIN;

-- ─── 1. NEW MEMBER SIGNUP NOTIFICATION ──────────────────────────────────────
-- Problem: handle_new_user assigned the gym_id to the user but NEVER created an admin notification.
-- Fix: Inject a "member_signup" notification targeting the exact gym_id.
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    v_gym_id UUID;
    v_name TEXT;
    v_role TEXT;
BEGIN
    v_gym_id := COALESCE((new.raw_user_meta_data->>'gym_id')::UUID, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'); -- Fallback to default gym
    v_name := COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User');
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'member');
    
    INSERT INTO public.users (
        id, email, name, role, gym_id, unique_id, created_at
    )
    VALUES (
        new.id, 
        new.email, 
        v_name, 
        v_role, 
        v_gym_id,
        public.generate_gym_member_id(v_gym_id),
        new.created_at
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    -- [NEW] Trigger Admin Notification for the specific gym
    IF v_role = 'member' THEN
        INSERT INTO public.notifications (
            user_id,
            gym_id,
            type,
            message,
            priority,
            is_read,
            status,
            action_url,
            action_label
        ) VALUES (
            NULL, -- Targeted at Gym Admin
            v_gym_id, -- Strictly scoped to the gym
            'member_signup',
            'New member registered: ' || v_name,
            3, -- Standard priority
            FALSE,
            'unread',
            '/members?search=' || new.id,
            'View Member'
        );
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 2. REINFORCE PAYMENT GYM_ID MAPPING ────────────────────────────────────
-- Problem: If a client app inserts a payment WITHOUT a gym_id, it orphans the notification.
-- Fix: Database trigger to forcefully intercept and inject the user's registered gym_id.
CREATE OR REPLACE FUNCTION public.ensure_payment_gym_id()
RETURNS TRIGGER AS $$
DECLARE
    v_user_gym_id UUID;
BEGIN
    IF NEW.gym_id IS NULL THEN
        SELECT gym_id INTO v_user_gym_id FROM public.users WHERE id = COALESCE(NEW.user_id, NEW.member_id);
        IF v_user_gym_id IS NOT NULL THEN
            NEW.gym_id := v_user_gym_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_payment_gym_id_trg ON public.payments;
CREATE TRIGGER ensure_payment_gym_id_trg
    BEFORE INSERT ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_payment_gym_id();


-- ─── 3. RE-INSTALL BULLETPROOF PAYMENT NOTIFICATION TRIGGER ─────────────────
-- Problem: Legacy implementations were conflicting or failing to query gym_id reliably.
-- Fix: Drop old triggers and install a single, strictly scoped version.
DROP TRIGGER IF EXISTS trigger_notify_admin_on_payment ON public.payments;
DROP TRIGGER IF EXISTS on_payment_created_notify_admin ON public.payments;
DROP TRIGGER IF EXISTS on_payment_created_notify_admin_v2 ON public.payments;
DROP FUNCTION IF EXISTS public.notify_admin_on_new_payment();
DROP FUNCTION IF EXISTS public.notify_admin_on_payment();

CREATE OR REPLACE FUNCTION public.notify_admin_on_new_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_payer_name TEXT;
  v_target_user_id UUID;
  v_gym_id UUID;
BEGIN
  v_target_user_id := COALESCE(NEW.user_id, NEW.member_id);
  
  -- Look up payer name and double check gym scope
  SELECT name, gym_id INTO v_payer_name, v_gym_id 
  FROM public.users WHERE id = v_target_user_id;

  IF v_payer_name IS NULL THEN v_payer_name := 'Member'; END IF;
  IF v_gym_id IS NULL THEN v_gym_id := NEW.gym_id; END IF;

  INSERT INTO public.notifications (
    user_id,
    gym_id,
    type,
    message,
    payment_id,
    priority,
    is_read,
    status,
    action_url,
    action_label
  ) VALUES (
    NULL, 
    v_gym_id, -- Guaranteed strict scoping
    'payment_pending',
    'New payment of ' || NEW.amount || ' from ' || v_payer_name,
    NEW.id,
    2,
    FALSE,
    'unread',
    '/finances',
    'Review Payment'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_payment_created_notify_admin
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_new_payment();


-- ─── 4. TOTAL SYSTEM AUDIT: ATTENDANCE & FACILITIES HARDENING ───────────────

-- 1. Attendance Logs (Ensuring table exists and is scoped)
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    checkin_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    status TEXT DEFAULT 'approved',
    membership_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure gym_id column exists
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id);

-- Backfill from user
UPDATE public.attendance_logs al SET gym_id = u.gym_id FROM public.users u WHERE al.user_id = u.id AND al.gym_id IS NULL;

-- Fix Attendance RLS (Was global, now gym-scoped)
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all attendance logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Admins can insert attendance logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Members can view their own attendance logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Gym admins view their gym attendance" ON public.attendance_logs;
DROP POLICY IF EXISTS "Gym admins register gym attendance" ON public.attendance_logs;

CREATE POLICY "Gym admins view their gym attendance" ON public.attendance_logs
    FOR SELECT USING (public.is_gym_admin(gym_id));

CREATE POLICY "Gym admins register gym attendance" ON public.attendance_logs
    FOR INSERT WITH CHECK (public.is_gym_admin(gym_id));

CREATE POLICY "Members can view their own attendance logs" ON public.attendance_logs
    FOR SELECT USING (auth.uid() = user_id);

-- 2. Gym Facilities (Was platform_admin ONLY, now Gym Admins can manage their own)
DROP POLICY IF EXISTS "Platform admins manage facilities" ON public.gym_facilities_equipment;
CREATE POLICY "Gym admins manage their facilities" ON public.gym_facilities_equipment
    FOR ALL USING (public.is_gym_admin(gym_id)) WITH CHECK (public.is_gym_admin(gym_id));


-- ─── 5. BACKFILL ORPHANED NOTIFICATIONS & ENSURE ADMIN VIEWABILITY ──────────
UPDATE public.payments p SET gym_id = u.gym_id FROM public.users u WHERE p.user_id = u.id AND p.gym_id IS NULL;
UPDATE public.notifications n SET gym_id = u.gym_id FROM public.users u WHERE (n.user_id = u.id OR n.member_id = u.id) AND n.gym_id IS NULL;
UPDATE public.notifications n SET gym_id = p.gym_id FROM public.payments p WHERE n.payment_id = p.id AND n.gym_id IS NULL;

-- Clear RLS conflicts so admins can definitively read/update their gym's notifications
DROP POLICY IF EXISTS "Gym admins view their gym notifications" ON public.notifications;
DROP POLICY IF EXISTS "Gym admins manage their gym notifications" ON public.notifications;

CREATE POLICY "Gym admins view their gym notifications" ON public.notifications
    FOR SELECT USING (public.is_gym_admin(gym_id) OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Gym admins manage their gym notifications" ON public.notifications
    FOR UPDATE USING (public.is_gym_admin(gym_id) OR auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (public.is_gym_admin(gym_id) OR auth.jwt() ->> 'role' = 'service_role');

COMMIT;

NOTIFY pgrst, 'reload schema';
