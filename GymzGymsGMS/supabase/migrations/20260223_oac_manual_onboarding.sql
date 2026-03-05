-- ============================================================================
-- OAC MANUAL ONBOARDING ENHANCEMENTS (No New Tables)
-- Uses existing gym_contacts to provision owner assignment.
-- ============================================================================

-- 1. Enhanced manual creation RPC
CREATE OR REPLACE FUNCTION public.oac_create_gym_and_invite(
    p_gym_name TEXT,
    p_owner_email TEXT,
    p_owner_name TEXT,
    p_location TEXT,
    p_city TEXT
) RETURNS UUID AS $$
DECLARE
    new_gym_id UUID;
BEGIN
    -- Only platform admins can use this
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Only platform administrators can manually provision gyms.';
    END IF;

    -- Provision the actual gym record using existing logic inline
    INSERT INTO public.gyms (
        name,
        location,
        city,
        status,
        subscription_plan,
        events_enabled,
        sponsors_enabled
    ) VALUES (
        p_gym_name,
        p_location,
        p_city,
        'draft', -- Start as draft because the admin still needs to fill out the wizard
        'pro',
        true,
        true
    ) RETURNING id INTO new_gym_id;

    -- Record the invitation securely in the existing gym_contacts table
    -- The handle_new_user trigger will read this later.
    INSERT INTO public.gym_contacts (
        gym_id,
        contact_type,
        name,
        role,
        email,
        phone
    ) VALUES (
        new_gym_id,
        'primary',
        p_owner_name,
        'owner',
        p_owner_email,
        'PND' -- Pending phone
    );

    RETURN new_gym_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update the handle_new_user trigger to honor gym_contacts
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    v_unique_id TEXT;
    v_thread_id TEXT;
    v_role TEXT;
    v_gym_id UUID;
    v_assigned_role TEXT;
BEGIN
    -- Check if there's an existing gym_contact inviting this email
    SELECT gym_id, role INTO v_gym_id, v_assigned_role
    FROM public.gym_contacts
    WHERE email = new.email AND is_active = true
    LIMIT 1;

    -- Determine role (use assigned role if found, else metadata, else member)
    v_role := COALESCE(v_assigned_role, new.raw_user_meta_data->>'role', 'member');
    
    -- IDs
    v_unique_id := public.generate_unique_user_id_v2();
    v_thread_id := gen_random_uuid()::text;

    INSERT INTO public.users (
        id, 
        email, 
        name, 
        first_name,
        last_name,
        role, 
        gym_id,
        gender,
        age,
        height,
        weight,
        goal,
        fitness_goal,
        membership_status, 
        status, 
        unique_id, 
        thread_id,
        created_at, 
        metadata,
        marketing_consent,
        marketing_consent_date
    )
    VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 
        new.raw_user_meta_data->>'first_name',
        new.raw_user_meta_data->>'last_name',
        v_role, 
        v_gym_id,
        new.raw_user_meta_data->>'gender',
        (new.raw_user_meta_data->>'age')::INTEGER,
        (new.raw_user_meta_data->>'height')::NUMERIC,
        (new.raw_user_meta_data->>'weight')::NUMERIC,
        COALESCE(new.raw_user_meta_data->>'goal', new.raw_user_meta_data->>'fitness_goal'),
        new.raw_user_meta_data->>'fitness_goal',
        'New', 
        'active', 
        v_unique_id, 
        v_thread_id,
        new.created_at, 
        new.raw_user_meta_data,
        (new.raw_user_meta_data->>'marketing_consent')::BOOLEAN,
        (new.raw_user_meta_data->>'marketing_consent_date')::TIMESTAMPTZ
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        gender = EXCLUDED.gender,
        age = EXCLUDED.age,
        height = EXCLUDED.height,
        weight = EXCLUDED.weight,
        goal = EXCLUDED.goal,
        fitness_goal = EXCLUDED.fitness_goal,
        updated_at = NOW();
        
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
