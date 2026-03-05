-- Migration: Update provision_new_gym to accept auth_id
-- This allows the Edge Function to link the Auth user correctly during provisioning.

CREATE OR REPLACE FUNCTION provision_new_gym(
    p_auth_id UUID,
    p_gym_name TEXT,
    p_owner_email TEXT,
    p_owner_name TEXT,
    p_location TEXT,
    p_feature_flags JSONB
) RETURNS UUID AS $$
DECLARE
    new_gym_id UUID;
BEGIN
    -- 1. Create the gym
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
    ) RETURNING id INTO new_gym_id;

    -- 2. Create/Update the initial admin user profile
    INSERT INTO public.users (
        id,
        email,
        name,
        role,
        gym_id,
        status,
        membership_status
    ) VALUES (
        p_auth_id,
        p_owner_email,
        p_owner_name,
        'admin',
        new_gym_id,
        'active',
        'Active'
    )
    ON CONFLICT (id) DO UPDATE SET
        gym_id = new_gym_id,
        role = 'admin',
        status = 'active',
        membership_status = 'Active';

    RETURN new_gym_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
