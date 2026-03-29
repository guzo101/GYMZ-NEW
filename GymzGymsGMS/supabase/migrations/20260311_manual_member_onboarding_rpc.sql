-- RPC to onboard old members with historical data
-- This handles auth user creation, public profile setup, historical payment logging, and membership sync.

CREATE OR REPLACE FUNCTION public.onboard_member_manually(
    p_gym_id UUID,
    p_name TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_plan_id UUID,
    p_paid_at TIMESTAMPTZ,
    p_admin_id UUID
) RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_plan_days INTEGER;
    v_renewal_date TIMESTAMPTZ;
    v_payment_id UUID;
    v_gym_slug TEXT;
BEGIN
    -- 1. Get plan duration
    SELECT duration_days INTO v_plan_days 
    FROM public.gym_membership_plans 
    WHERE id = p_plan_id AND gym_id = p_gym_id;

    IF v_plan_days IS NULL THEN
        RAISE EXCEPTION 'Membership plan not found or does not belong to this gym.';
    END IF;

    -- 2. Calculate renewal date based on historical paid_at
    v_renewal_date := p_paid_at + (v_plan_days || ' days')::INTERVAL;

    -- 3. Check if Auth user exists, else create with temporary password
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
    
    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', 
            p_email, crypt('Gymz123!', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('name', p_name, 'role', 'member'),
            now(), now()
        );
    END IF;

    -- 4. Upsert Public User Profile
    INSERT INTO public.users (
        id, email, name, phone, role, gym_id, status, membership_status, renewal_due_date, last_payment_date
    ) VALUES (
        v_user_id, p_email, p_name, p_phone, 'member', p_gym_id, 'active', 'Active', v_renewal_date, p_paid_at
    ) ON CONFLICT (id) DO UPDATE SET
        gym_id = p_gym_id,
        role = 'member',
        status = 'active',
        membership_status = 'Active',
        renewal_due_date = v_renewal_date,
        last_payment_date = p_paid_at;

    -- 5. Log Historical Payment
    INSERT INTO public.payments (
        gym_id, user_id, amount, currency, status, payment_method, 
        plan_id, plan_name, description, created_at, updated_at
    ) SELECT 
        p_gym_id, v_user_id, price, currency, 'approved', 'cash', 
        p_plan_id, plan_name, 'Historical payment migration', p_paid_at, p_paid_at
    FROM public.gym_membership_plans 
    WHERE id = p_plan_id
    RETURNING id INTO v_payment_id;

    -- 6. Ensure Membership (SSoT) record is Active
    INSERT INTO public.membership (
        user_id, gym_id, membership_status, approved, paid_at, 
        approved_at, approved_by, plan_id, renewal_date
    ) VALUES (
        v_user_id, p_gym_id, 'active', true, p_paid_at, 
        p_paid_at, p_admin_id, p_plan_id, v_renewal_date
    ) ON CONFLICT (user_id) DO UPDATE SET
        membership_status = 'active',
        approved = true,
        paid_at = p_paid_at,
        approved_at = p_paid_at,
        approved_by = p_admin_id,
        plan_id = p_plan_id,
        renewal_date = v_renewal_date;

    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.onboard_member_manually TO authenticated;
GRANT EXECUTE ON FUNCTION public.onboard_member_manually TO service_role;
