-- ============================================================================
-- GYMZ SECURITY HARDENING: STRICT GYM ISOLATION & PROFESSIONAL MEMBER IDS
-- Date: 2026-02-25
-- ============================================================================

BEGIN;

-- ─── 1. CORE HELPERS & SCHEMA EXTENSIONS ────────────────────────────────────

-- Add short_code to gyms for professional ID prefixes (e.g., 'SG' for Sky Gym)
ALTER TABLE public.gyms ADD COLUMN IF NOT EXISTS short_code TEXT;

-- Create a lookup function for gym short codes with fallback
CREATE OR REPLACE FUNCTION public.get_gym_prefix(p_gym_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_code TEXT;
BEGIN
    SELECT short_code INTO v_code FROM public.gyms WHERE id = p_gym_id;
    -- Fallback to first two letters of name if short_code is missing
    IF v_code IS NULL OR v_code = '' THEN
        SELECT UPPER(SUBSTRING(name, 1, 2)) INTO v_code FROM public.gyms WHERE id = p_gym_id;
    END IF;
    RETURN COALESCE(v_code, 'GY');
END;
$$;

-- Create a hardened admin check that is GYM-SCOPED
-- SECURITY DEFINER allows it to bypass RLS to check the users table itself
CREATE OR REPLACE FUNCTION public.is_gym_admin(p_gym_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND gym_id = p_gym_id
        AND role IN ('admin', 'super_admin')
    );
$$;

-- Add gym_id to tables that were missing it for strict scoping
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id);
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id);
ALTER TABLE public.notice_board ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id);
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id);

-- Backfill gym_id for isolated records
-- 1. Users fallback to default gym if unknown
UPDATE public.users SET gym_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' WHERE gym_id IS NULL;

-- 2. Payments/Subscriptions backfill from user
UPDATE public.payments p SET gym_id = u.gym_id FROM public.users u WHERE p.user_id = u.id AND p.gym_id IS NULL;
UPDATE public.subscriptions s SET gym_id = u.gym_id FROM public.users u WHERE s.user_id = u.id AND s.gym_id IS NULL;

-- 3. Notice Board backfill from author
UPDATE public.notice_board nb SET gym_id = u.gym_id FROM public.users u WHERE nb.user_id = u.id AND nb.gym_id IS NULL;

-- 4. Rooms backfill from admin
UPDATE public.rooms r SET gym_id = u.gym_id FROM public.users u WHERE r.admin_id = u.id AND r.gym_id IS NULL;


-- ─── 2. PROFESSIONAL MEMBER ID GENERATION ────────────────────────────────────

-- Table to track sequences per gym (robust and scalable)
CREATE TABLE IF NOT EXISTS public.gym_id_sequences (
    gym_id UUID PRIMARY KEY REFERENCES public.gyms(id) ON DELETE CASCADE,
    last_sequence_number INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to generate the professional ID: [PREFIX][YY][4-DIGIT-SEQ]
CREATE OR REPLACE FUNCTION public.generate_gym_member_id(p_gym_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_prefix TEXT;
    v_year TEXT;
    v_new_seq INTEGER;
BEGIN
    -- 1. Get Prefix
    v_prefix := public.get_gym_prefix(p_gym_id);
    
    -- 2. Get Year (YY format)
    v_year := to_char(CURRENT_DATE, 'YY');
    
    -- 3. Atomically increment and get sequence
    INSERT INTO public.gym_id_sequences (gym_id, last_sequence_number)
    VALUES (p_gym_id, 1)
    ON CONFLICT (gym_id) DO UPDATE 
    SET last_sequence_number = gym_id_sequences.last_sequence_number + 1,
        updated_at = NOW()
    RETURNING last_sequence_number INTO v_new_seq;
    
    -- 4. Format: SG260001
    RETURN v_prefix || v_year || LPAD(v_new_seq::text, 4, '0');
END;
$$;


-- ─── 3. REFACTORED RLS POLICIES (STRICT ISOLATION) ──────────────────────────

-- Helper function to drop all public policies (Redundant but safe for this specific hardening migration)
-- This ensures we don't have legacy global admin policies lingering.

DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN (
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND policyname LIKE '%manage_admin%' OR policyname LIKE '%Admins Full Access%'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Hardened Users Policy
DROP POLICY IF EXISTS "table_users_gym_isolation" ON public.users;
DROP POLICY IF EXISTS "table_users_manage_admin" ON public.users;
CREATE POLICY "table_users_gym_isolation"
ON public.users FOR ALL
USING (
    auth.uid() = id -- User can see self
    OR 
    public.is_gym_admin(gym_id) -- Admin can see ONLY their gym's users
)
WITH CHECK (
    auth.uid() = id 
    OR 
    public.is_gym_admin(gym_id)
);

-- Hardened Payments Policy
DROP POLICY IF EXISTS "table_payments_gym_isolation" ON public.payments;
CREATE POLICY "table_payments_gym_isolation"
ON public.payments FOR ALL
USING (
    auth.uid() = user_id -- User can see own payments
    OR 
    public.is_gym_admin(gym_id) -- Admin can see ONLY their gym's payments
)
WITH CHECK (
    auth.uid() = user_id 
    OR 
    public.is_gym_admin(gym_id)
);

-- Hardened Subscriptions Policy
DROP POLICY IF EXISTS "table_subscriptions_gym_isolation" ON public.subscriptions;
CREATE POLICY "table_subscriptions_gym_isolation"
ON public.subscriptions FOR ALL
USING (
    auth.uid() = user_id 
    OR 
    public.is_gym_admin(gym_id)
)
WITH CHECK (
    auth.uid() = user_id 
    OR 
    public.is_gym_admin(gym_id)
);

-- Hardened Gym Onboarding Status
DROP POLICY IF EXISTS "table_onboarding_gym_isolation" ON public.gym_onboarding_status;
CREATE POLICY "table_onboarding_gym_isolation"
ON public.gym_onboarding_status FOR ALL
USING (public.is_gym_admin(gym_id))
WITH CHECK (public.is_gym_admin(gym_id));

-- Hardened Notice Board
DROP POLICY IF EXISTS "table_notice_board_gym_isolation" ON public.notice_board;
CREATE POLICY "table_notice_board_gym_isolation"
ON public.notice_board FOR ALL
USING (public.is_gym_admin(gym_id))
WITH CHECK (public.is_gym_admin(gym_id));

-- Hardened Rooms
DROP POLICY IF EXISTS "table_rooms_gym_isolation" ON public.rooms;
CREATE POLICY "table_rooms_gym_isolation"
ON public.rooms FOR ALL
USING (public.is_gym_admin(gym_id))
WITH CHECK (public.is_gym_admin(gym_id));

-- Hardened Gym Classes
DROP POLICY IF EXISTS "table_classes_gym_isolation" ON public.gym_classes;
CREATE POLICY "table_classes_gym_isolation"
ON public.gym_classes FOR ALL
USING (public.is_gym_admin(gym_id) OR public.is_platform_admin())
WITH CHECK (public.is_gym_admin(gym_id) OR public.is_platform_admin());

-- Hardened Gym Trainers
DROP POLICY IF EXISTS "table_trainers_gym_isolation" ON public.gym_trainers;
CREATE POLICY "table_trainers_gym_isolation"
ON public.gym_trainers FOR ALL
USING (public.is_gym_admin(gym_id) OR public.is_platform_admin())
WITH CHECK (public.is_gym_admin(gym_id) OR public.is_platform_admin());


-- ─── 4. TRIGGER UPDATES ──────────────────────────────────────────────────────

-- Update handle_new_user to use the professional generator
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

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. BACKFILL EXISTING IDS ────────────────────────────────────────────────

-- Update all existing users who don't have a gym-linked ID yet
DO $$
DECLARE
    u RECORD;
BEGIN
    FOR u IN SELECT id, gym_id FROM public.users WHERE unique_id NOT SIMILAR TO '[A-Z]{2,}[0-9]{6}' LOOP
        UPDATE public.users 
        SET unique_id = public.generate_gym_member_id(u.gym_id)
        WHERE id = u.id;
    END LOOP;
END $$;

-- ─── 6. HARDEN NOTIFICATIONS ISOLATION ──────────────────────────────────────
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id);

-- Backfill notifications gym_id from user_id or member_id if possible
UPDATE public.notifications n
SET gym_id = u.gym_id
FROM public.users u
WHERE (n.user_id = u.id OR n.member_id = u.id)
AND n.gym_id IS NULL;

-- Backfill from payments if available
UPDATE public.notifications n
SET gym_id = p.gym_id
FROM public.payments p
WHERE n.payment_id = p.id
AND n.gym_id IS NULL;

-- Update Notifications RLS
DROP POLICY IF EXISTS "Admins Full Access" ON public.notifications;
DROP POLICY IF EXISTS "Users Own Data" ON public.notifications;

-- Admin: Only see notifications for their gym
DROP POLICY IF EXISTS "Gym admins view their gym notifications" ON public.notifications;
CREATE POLICY "Gym admins view their gym notifications" ON public.notifications
    FOR SELECT USING (is_gym_admin(gym_id));

-- Admin: Full access for their gym (to mark as read, etc)
DROP POLICY IF EXISTS "Gym admins manage their gym notifications" ON public.notifications;
CREATE POLICY "Gym admins manage their gym notifications" ON public.notifications
    FOR ALL USING (is_gym_admin(gym_id)) WITH CHECK (is_gym_admin(gym_id));

-- Member: Only see their own notifications
DROP POLICY IF EXISTS "Members view own notifications" ON public.notifications;
CREATE POLICY "Members view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Member: Update own read status
DROP POLICY IF EXISTS "Members update own notifications" ON public.notifications;
CREATE POLICY "Members update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Platform Admin: Full Access
DROP POLICY IF EXISTS "Platform admins manage all notifications" ON public.notifications;
CREATE POLICY "Platform admins manage all notifications" ON public.notifications
    FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Update Triggers for notifications
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_payment()
RETURNS TRIGGER AS $$
DECLARE
  payer_name TEXT;
  target_user_id UUID;
BEGIN
  target_user_id := COALESCE(NEW.user_id, NEW.member_id);
  
  SELECT name INTO payer_name FROM public.users WHERE id = target_user_id;
  IF payer_name IS NULL THEN payer_name := 'Member'; END IF;

  INSERT INTO public.notifications (
    user_id,
    gym_id,
    type,
    message,
    payment_id,
    priority,
    is_read
  ) VALUES (
    NULL, -- For Admin
    NEW.gym_id, -- SCOPED TO GYM
    'payment_pending',
    'New payment of ' || NEW.amount || ' from ' || payer_name,
    NEW.id,
    2,
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

NOTIFY pgrst, 'reload schema';
