-- ============================================================================
-- TENANT NOTIFICATION & PAYMENT MAPPING ENFORCEMENT
-- Date: 2026-02-28
-- Fixes: Admins unreliably receiving new member/payment notifications 
-- ============================================================================

BEGIN;

-- ─── 1. NEW MEMBER SIGNUP NOTIFICATION ──────────────────────────────────────

-- Update handle_new_user to securely send a "member_signup" notification to the Gym Admin
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

-- If a payment is somehow inserted by a client app without a gym_id, 
-- we must intercept it and assign the gym_id from the user, otherwise 
-- the admin will never see it due to RLS.

CREATE OR REPLACE FUNCTION public.ensure_payment_gym_id()
RETURNS TRIGGER AS $$
DECLARE
    v_user_gym_id UUID;
BEGIN
    -- If gym_id is missing, try to resolve it from the payer's profile
    IF NEW.gym_id IS NULL THEN
        SELECT gym_id INTO v_user_gym_id FROM public.users WHERE id = COALESCE(NEW.user_id, NEW.member_id);
        
        IF v_user_gym_id IS NOT NULL THEN
            NEW.gym_id := v_user_gym_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger BEFORE INSERT so NEW.gym_id is populated before notify_admin_on_new_payment fires
DROP TRIGGER IF EXISTS ensure_payment_gym_id_trg ON public.payments;
CREATE TRIGGER ensure_payment_gym_id_trg
    BEFORE INSERT ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_payment_gym_id();


-- ─── 3. BACKFILL ORPHANED PAYMENTS & NOTIFICATIONS ──────────────────────────

-- Fix any old payments that lacked a gym_id
UPDATE public.payments p 
SET gym_id = u.gym_id 
FROM public.users u 
WHERE p.user_id = u.id AND p.gym_id IS NULL;

-- Re-run previous notification backfill just to be absolutely certain
UPDATE public.notifications n
SET gym_id = u.gym_id
FROM public.users u
WHERE (n.user_id = u.id OR n.member_id = u.id)
AND n.gym_id IS NULL;

UPDATE public.notifications n
SET gym_id = p.gym_id
FROM public.payments p
WHERE n.payment_id = p.id
AND n.gym_id IS NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
