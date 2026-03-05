-- ============================================================================
-- GYMZ: Consolidated SQL-Only Provisioning
-- Handles: 1. Password Storage, 2. Auth User Creation, 3. Gym Provisioning
-- ============================================================================

-- 1. Ensure password field exists in applications for temporary storage
ALTER TABLE public.gym_applications 
ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. Ensure pgcrypto is enabled for secure password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 3. Create the All-In-One Provisioning RPC
CREATE OR REPLACE FUNCTION public.provision_new_gym(
    p_gym_name TEXT,
    p_owner_email TEXT,
    p_owner_name TEXT,
    p_owner_password TEXT,
    p_location TEXT,
    p_feature_flags JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_new_gym_id UUID;
    v_auth_id UUID;
BEGIN
    -- A. Check if user already exists in auth.users
    SELECT id INTO v_auth_id FROM auth.users WHERE email = p_owner_email;
    
    -- B. If not, create them directly in auth.users
    IF v_auth_id IS NULL THEN
        v_auth_id := gen_random_uuid();
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_auth_id,
            'authenticated',
            'authenticated',
            p_owner_email,
            crypt(p_owner_password, gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('name', p_owner_name, 'role', 'admin'),
            now(),
            now(),
            '',
            '',
            '',
            ''
        );
    END IF;

    -- C. Create the gym
    INSERT INTO public.gyms (
        name, 
        location, 
        status, 
        subscription_plan,
        events_enabled,
        sponsors_enabled
    ) VALUES (
        p_gym_name, 
        p_location, 
        'active', 
        'pro',
        COALESCE((p_feature_flags->>'events_enabled')::boolean, true),
        COALESCE((p_feature_flags->>'sponsors_enabled')::boolean, true)
    ) RETURNING id INTO v_new_gym_id;

    -- D. Create/Update the public user profile
    -- The handle_new_user trigger might fire, but we 'upsert' here to be sure
    INSERT INTO public.users (
        id,
        email,
        name,
        role,
        gym_id,
        status,
        membership_status
    ) VALUES (
        v_auth_id,
        p_owner_email,
        p_owner_name,
        'admin',
        v_new_gym_id,
        'active',
        'Active'
    )
    ON CONFLICT (id) DO UPDATE SET
        gym_id = v_new_gym_id,
        role = 'admin',
        status = 'active',
        membership_status = 'Active';

    RETURN v_new_gym_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant access to authenticated users (Platform Admins)
GRANT EXECUTE ON FUNCTION public.provision_new_gym TO authenticated;
GRANT EXECUTE ON FUNCTION public.provision_new_gym TO service_role;
