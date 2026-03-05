-- GYMZ: UPDATE MANUAL ONBOARDING WITH PASSWORD SUPPORT
-- 1. Drop old versions to prevent overload errors
DROP FUNCTION IF EXISTS public.oac_create_gym_and_invite(TEXT, TEXT, TEXT, TEXT, TEXT);

-- 2. Create the Enhanced Manual Provisioning RPC
CREATE OR REPLACE FUNCTION public.oac_create_gym_and_invite(
    p_gym_name TEXT,
    p_owner_email TEXT,
    p_owner_name TEXT,
    p_owner_password TEXT,
    p_city TEXT,
    p_location TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_new_gym_id UUID;
    v_auth_id UUID;
    v_slug TEXT;
BEGIN
    -- Only platform admins can use this
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Only platform administrators can manually provision gyms.';
    END IF;

    -- A. Generate Slug
    v_slug := lower(regexp_replace(p_gym_name, '[^a-zA-Z0-9]+', '-', 'g'));
    IF v_slug = '' OR v_slug = '-' THEN v_slug := 'gym'; END IF;
    v_slug := trim(both '-' from v_slug) || '-' || substr(md5(random()::text), 1, 6);

    -- B. Create Auth User immediately for "Instant Login"
    SELECT id INTO v_auth_id FROM auth.users WHERE email = p_owner_email;
    IF v_auth_id IS NULL THEN
        v_auth_id := gen_random_uuid();
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_auth_id, 'authenticated', 'authenticated', 
            p_owner_email, crypt(p_owner_password, gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('name', p_owner_name, 'role', 'admin'),
            now(), now()
        );
    END IF;

    -- C. Create Gym
    INSERT INTO public.gyms (
        name, slug, location, city, status, subscription_plan, events_enabled, sponsors_enabled
    ) VALUES (
        p_gym_name, v_slug, p_location, p_city, 'draft', 'pro', true, true
    ) RETURNING id INTO v_new_gym_id;

    -- D. Initial Onboarding Status
    INSERT INTO public.gym_onboarding_status (gym_id, status, completeness_score)
    VALUES (v_new_gym_id, 'draft', 0)
    ON CONFLICT (gym_id) DO NOTHING;

    -- E. Link the admin profile
    INSERT INTO public.users (id, email, name, role, gym_id, status, membership_status)
    VALUES (v_auth_id, p_owner_email, p_owner_name, 'admin', v_new_gym_id, 'active', 'Active')
    ON CONFLICT (id) DO UPDATE SET
        gym_id = v_new_gym_id, role = 'admin', status = 'active';

    RETURN v_new_gym_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Restore permissions
GRANT EXECUTE ON FUNCTION public.oac_create_gym_and_invite TO authenticated;
