-- ============================================================================
-- FIX v2: onboard_member_manually RPC - definitive column alignment
-- 
-- The payments table does NOT have:
--   ❌ currency      (lives on gym_membership_plans, not payments)
--   ❌ plan_name     (lives on gym_membership_plans, not payments)
--   ❌ payment_method (does not exist on payments table)
--
-- The payments table DOES have:
--   ✅ id, user_id, member_id, amount, status, payment_status
--   ✅ paid_at, payment_date, description, gym_id, plan_id
--   ✅ tip_amount, months, updated_at, created_at, approved_by, approved_at
--   ✅ transaction_reference, mobile_number, bank_name, account_number, trainer_id
-- ============================================================================

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
    v_plan_name TEXT;
    v_plan_price NUMERIC;
    v_renewal_date TIMESTAMPTZ;
    v_payment_id UUID;
BEGIN
    -- 1. Get plan details (duration, name, price)
    SELECT duration_days, plan_name, price
    INTO v_plan_days, v_plan_name, v_plan_price
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

    -- 5. Log Historical Payment using ONLY columns that exist on the payments table.
    --    Note: payment_method, currency, plan_name do NOT exist — use description instead.
    INSERT INTO public.payments (
        gym_id,
        user_id,
        member_id,
        amount,
        status,
        plan_id,
        description,
        paid_at,
        payment_date,
        created_at,
        updated_at,
        approved_by,
        approved_at
    ) VALUES (
        p_gym_id,
        v_user_id,
        v_user_id,
        v_plan_price,
        'approved',
        p_plan_id,
        'Historical cash payment - ' || v_plan_name,
        p_paid_at,
        p_paid_at,
        p_paid_at,
        p_paid_at,
        p_admin_id,
        p_paid_at
    )
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

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
