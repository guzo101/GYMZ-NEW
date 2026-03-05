-- CONSOLIDATED ONBOARDING SYSTEM (App & GMS Sync)
-- Purpose: Ensure the 'public.users' table and the Auth trigger handle all onboarding fields correctly.
-- This unifies the "App" and "GMS" backend logic.

BEGIN;

-- 1. Ensure all onboarding columns exist on public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS height NUMERIC;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weight NUMERIC;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS goal TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fitness_goal TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS marketing_consent_date TIMESTAMPTZ;

-- 2. Update the handle_new_user function to map these fields
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    v_unique_id TEXT;
    v_thread_id TEXT;
    v_role TEXT;
BEGIN
    -- Determine role (default to member unless metadata says admin)
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'member');
    
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

COMMIT;

NOTIFY pgrst, 'reload schema';
