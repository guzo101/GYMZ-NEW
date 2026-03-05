-- ============================================================================
-- GYM ISOLATION: FINAL NOTIFICATION & PAYMENT ROUTING
-- Date: 2026-02-28
-- Reason: Admins not receiving new signups or payment notifications.
-- ============================================================================

BEGIN;

-- 1. DROP CONFLICTING TRIGGERS & FUNCTIONS
-- We clear out all legacy variations to ensure a clean slate.
DROP TRIGGER IF EXISTS on_payment_created_notify_admin ON public.payments;
DROP TRIGGER IF EXISTS on_payment_created_notify_admin_v2 ON public.payments;
DROP TRIGGER IF EXISTS trigger_notify_admin_on_payment ON public.payments;
DROP FUNCTION IF EXISTS public.notify_admin_on_new_payment();
DROP FUNCTION IF EXISTS public.notify_admin_on_payment();

-- 2. CREATE BULLETPROOF PAYMENT NOTIFICATION TRIGGER
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_payer_name TEXT;
  v_target_user_id UUID;
  v_gym_id UUID;
BEGIN
  -- Identify the user
  v_target_user_id := COALESCE(NEW.user_id, NEW.member_id);
  
  -- Look up the payer's name and gym_id
  SELECT name, gym_id INTO v_payer_name, v_gym_id 
  FROM public.users WHERE id = v_target_user_id;

  IF v_payer_name IS NULL THEN v_payer_name := 'Member'; END IF;
  
  -- Fallback gym_id to the payment row if the user lookup failed
  IF v_gym_id IS NULL THEN v_gym_id := NEW.gym_id; END IF;

  -- Create Notification for ADMIN (user_id = NULL indicates it's a global/admin notice)
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
    NULL, -- Targeted at Admin
    v_gym_id, -- SCOPED TO THE CORRECT GYM
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

-- Attach Trigger to Payments
CREATE TRIGGER on_payment_created_notify_admin
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_new_payment();

-- 3. ENSURE NEW USERS TRIGGER NOTIFICATIONS FOR ADMINS
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

    -- [NEW] Trigger Admin Notification for the specific gym ONLY if they are a regular member
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

-- 4. FIX NOTIFICATIONS RLS TO ENSURE ADMINS CAN SEE THEM
-- Drop old conflicting policies
DROP POLICY IF EXISTS "Admins Full Access" ON public.notifications;
DROP POLICY IF EXISTS "Gym admins view their gym notifications" ON public.notifications;
DROP POLICY IF EXISTS "Gym admins manage their gym notifications" ON public.notifications;
DROP POLICY IF EXISTS "Platform admins manage all notifications" ON public.notifications;

-- We rely on the `is_gym_admin` helper we created in the hardending script
CREATE POLICY "Gym admins view their gym notifications" ON public.notifications
    FOR SELECT USING (public.is_gym_admin(gym_id) OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Gym admins manage their gym notifications" ON public.notifications
    FOR UPDATE USING (public.is_gym_admin(gym_id) OR auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (public.is_gym_admin(gym_id) OR auth.jwt() ->> 'role' = 'service_role');

-- Create an overarching platform admin policy just in case
CREATE POLICY "Platform admins manage all notifications" ON public.notifications
    FOR ALL USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin'
    );

COMMIT;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
