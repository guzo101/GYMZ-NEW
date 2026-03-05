-- Migration: Create Gym Applications table for Phase 6 GOS
-- This table stores self-service applications from gym owners.

CREATE TABLE IF NOT EXISTS public.gym_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    feature_flags JSONB DEFAULT '{"events_enabled": true, "sponsors_enabled": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.gym_applications ENABLE ROW LEVEL SECURITY;

-- 1. Anyone can submit an application
CREATE POLICY "Anyone can submit a gym application"
ON public.gym_applications FOR INSERT
WITH CHECK (true);

-- 2. Only platform admins can view or manage applications
CREATE POLICY "Platform admins can view applications"
ON public.gym_applications FOR SELECT
USING (auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'platform_admin'
));

CREATE POLICY "Platform admins can update applications"
ON public.gym_applications FOR UPDATE
USING (auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'platform_admin'
));

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_gym_application_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_gym_application_timestamp
BEFORE UPDATE ON public.gym_applications
FOR EACH ROW EXECUTE FUNCTION update_gym_application_timestamp();

-- 3. Automated Provisioning Logic
-- This function is called when a platform admin approves an application.
-- It creates the gym and the initial admin user profile.
CREATE OR REPLACE FUNCTION provision_new_gym(
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

    -- 2. Create the initial admin user profile
    -- The user will need to sign up/reset password with this email to link to Auth
    INSERT INTO public.users (
        email,
        name,
        role,
        gym_id,
        status,
        membership_status
    ) VALUES (
        p_owner_email,
        p_owner_name,
        'admin',
        new_gym_id,
        'active',
        'Active'
    );

    RETURN new_gym_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
