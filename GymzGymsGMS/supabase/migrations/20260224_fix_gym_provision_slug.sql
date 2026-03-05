-- ============================================================================
-- FIX SLUG IN GYM PROVISIONING
-- Updates functions to provide a basic slug to satisfy the not-null constraint
-- ============================================================================

CREATE OR REPLACE FUNCTION public.provision_new_gym(
    p_gym_name TEXT,
    p_owner_email TEXT,
    p_owner_name TEXT,
    p_location TEXT,
    p_feature_flags JSONB
) RETURNS UUID AS $$
DECLARE
    new_gym_id UUID;
    v_slug TEXT;
BEGIN
    -- Generate basic slug from gym name
    v_slug := lower(regexp_replace(p_gym_name, '[^a-zA-Z0-9]+', '-', 'g'));
    -- Ensure it's not empty
    IF v_slug = '' OR v_slug = '-' THEN
        v_slug := 'gym';
    END IF;
    -- Remove trailing or leading dashes just in case
    v_slug := trim(both '-' from v_slug);
    
    -- Append random string to prevent uniqueness collisions on the slug
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);

    INSERT INTO public.gyms (
        name,
        slug,
        location,
        status,
        subscription_plan,
        events_enabled,
        sponsors_enabled
    ) VALUES (
        p_gym_name,
        v_slug,
        p_location,
        'active',
        'pro',
        COALESCE((p_feature_flags->>'events_enabled')::boolean, true),
        COALESCE((p_feature_flags->>'sponsors_enabled')::boolean, true)
    ) RETURNING id INTO new_gym_id;

    RETURN new_gym_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.oac_create_gym_and_invite(
    p_gym_name TEXT,
    p_owner_email TEXT,
    p_owner_name TEXT,
    p_location TEXT,
    p_city TEXT
) RETURNS UUID AS $$
DECLARE
    new_gym_id UUID;
    v_slug TEXT;
BEGIN
    -- Only platform admins can use this
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Only platform administrators can manually provision gyms.';
    END IF;

    -- Generate basic slug from gym name
    v_slug := lower(regexp_replace(p_gym_name, '[^a-zA-Z0-9]+', '-', 'g'));
    IF v_slug = '' OR v_slug = '-' THEN
        v_slug := 'gym';
    END IF;
    v_slug := trim(both '-' from v_slug) || '-' || substr(md5(random()::text), 1, 6);

    -- Provision the actual gym record using existing logic inline
    INSERT INTO public.gyms (
        name,
        slug,
        location,
        city,
        status,
        subscription_plan,
        events_enabled,
        sponsors_enabled
    ) VALUES (
        p_gym_name,
        v_slug,
        p_location,
        p_city,
        'draft', -- Start as draft because the admin still needs to fill out the wizard
        'pro',
        true,
        true
    ) RETURNING id INTO new_gym_id;

    -- Create an initial onboarding status
    INSERT INTO public.gym_onboarding_status (gym_id, status, completeness_score)
    VALUES (new_gym_id, 'draft', 0);

    -- Record the invitation for the owner securely
    INSERT INTO public.gym_invitations (gym_id, email, role)
    VALUES (new_gym_id, p_owner_email, 'owner');

    RETURN new_gym_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
