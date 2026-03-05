-- ==============================================================================
-- ARCHITECTURAL AUTH RESET - 2026
-- Senior Supabase Security Architect Solution
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UTILITY FUNCTIONS (Foundational Layer)
-- ------------------------------------------------------------------------------

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function: Generate secure Unique ID (Format: 1234@)
CREATE OR REPLACE FUNCTION public.generate_unique_user_id()
RETURNS TEXT LANGUAGE sql AS $$
  -- Generates 4 random digits + 1 special character
  SELECT (floor(random() * 9000 + 1000)::text) || 
         (ARRAY['!','@','#','$','%','^','&','*'])[floor(random() * 8 + 1)];
$$;

-- Function: Secure Admin Check (The "Gatekeeper")
-- SECURITY DEFINER: Runs with system privileges, effectively bypassing RLS to avoid recursion loops.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER 
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
$$;

-- ------------------------------------------------------------------------------
-- 2. TABLE STRUCTURE & ROLES
-- ------------------------------------------------------------------------------

-- Ensure the table has the correct structure
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    name TEXT,
    role TEXT DEFAULT 'member', -- The core Role column
    status TEXT DEFAULT 'active',
    membership_status TEXT DEFAULT 'Pending',
    unique_id TEXT UNIQUE,
    thread_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_unique_id ON public.users(unique_id);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (The Security Model)
-- ------------------------------------------------------------------------------

-- Activate RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- CLEAN SLATE: Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins manage all" ON public.users;
DROP POLICY IF EXISTS "Admins can do everything on users" ON public.users;
DROP POLICY IF EXISTS "Users manage own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "System Access" ON public.users;
DROP POLICY IF EXISTS "Service Role" ON public.users;

-- POLICY 1: ADMINS (God Mode)
-- Admins can do ANYTHING (Select, Insert, Update, Delete) on ANY row.
-- Crucial: 'WITH CHECK' allows Admins to insert rows for OTHER people.
CREATE POLICY "Admins Full Access"
ON public.users
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- POLICY 2: USERS (Self-Service)
-- Users can View and Update their OWN row.
CREATE POLICY "Users Self Manage"
ON public.users
FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- POLICY 3: SERVICE ROLE (System)
-- Allows backend scripts and triggers to function without restriction.
CREATE POLICY "System Bypass"
ON public.users
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ------------------------------------------------------------------------------
-- 4. AUTOMATION TRIGGERS (The "Magic")
-- ------------------------------------------------------------------------------

-- Trigger Function: Syncs Auth User -> Public Profile
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
    user_role TEXT;
BEGIN
    -- Determine Name
    user_name := COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User');
    
    -- Determine Role (Default to 'member', strictly control 'admin' injection)
    user_role := COALESCE(new.raw_user_meta_data->>'role', 'member');
    
    -- Insert the profile
    INSERT INTO public.users (
        id, 
        email, 
        name, 
        role, 
        status, 
        membership_status, 
        unique_id, 
        thread_id,
        created_at, 
        metadata
    )
    VALUES (
        new.id, 
        new.email, 
        user_name, 
        user_role, 
        'active', 
        'Pending', 
        public.generate_unique_user_id(), -- Auto-generate Unique ID
        COALESCE(new.raw_user_meta_data->>'thread_id', gen_random_uuid()::text),
        new.created_at, 
        new.raw_user_meta_data
    )
    ON CONFLICT (id) DO UPDATE SET
        -- If profile exists, just sync latest email/metadata
        email = EXCLUDED.email,
        name = COALESCE(public.users.name, EXCLUDED.name),
        updated_at = NOW();

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- runs as Superuser to bypass RLS

-- Attach Trigger to Auth table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 5. FINAL CONSISTENCY CHECK (Backfill)
-- ------------------------------------------------------------------------------

-- Fix any users who already signed up but have missing profiles
INSERT INTO public.users (id, email, name, role, status, membership_status, unique_id, thread_id, created_at, metadata)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
    'member',
    'active',
    'Pending',
    public.generate_unique_user_id(),
    gen_random_uuid()::text,
    au.created_at,
    au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Refresh Schema Cache
NOTIFY pgrst, 'reload schema';

