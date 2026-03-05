-- ============================================
-- FIX ADMIN AUTH - FINAL SOLUTION
-- ============================================
-- Problem: Admin login bypasses Supabase Auth, causing RLS violations
-- Solution: Create admin user in auth.users table with proper credentials

-- 1. First, ensure the admin exists in auth.users
-- Note: This requires manual creation via Supabase Dashboard or API
-- The admin credentials should be: admin@Gymz.com / Admin@123

-- 2. Update helper function to be more robust
DROP FUNCTION IF EXISTS public.is_admin();
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check if current user is admin by querying users table as superuser
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
END;
$$;

-- 3. Reset RLS Policies with proper permissions
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "OPEN ACCESS" ON public.users;
DROP POLICY IF EXISTS "Admins Full Access" ON public.users;
DROP POLICY IF EXISTS "Members Self Manage" ON public.users;
DROP POLICY IF EXISTS "Allow Signup" ON public.users;
DROP POLICY IF EXISTS "System Bypass" ON public.users;
DROP POLICY IF EXISTS "Allow Insert Authenticated" ON public.users;

-- POLICY 1: Service Role (Superuser for triggers and backend)
CREATE POLICY "Service Role Full Access"
ON public.users
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- POLICY 2: Admins (Full Access via safe function)
CREATE POLICY "Admin Full Access"
ON public.users
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- POLICY 3: Users (Self Management)
CREATE POLICY "User Self Management"
ON public.users
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "User Self Update"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- POLICY 4: Allow authenticated users to insert their own record
-- This allows the trigger to work properly
CREATE POLICY "User Self Insert"
ON public.users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 4. Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 5. Recreate the sync trigger with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    user_name TEXT;
    user_role TEXT;
    unique_user_id TEXT;
BEGIN
    -- Generate unique ID (format: 1234@)
    unique_user_id := (floor(random() * 9000 + 1000)::text) || 
                      (ARRAY['!','@','#','$','%','^','&','*'])[floor(random() * 8 + 1)];
    
    -- Determine Name
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'name', 
        split_part(NEW.email, '@', 1), 
        'User'
    );
    
    -- Determine Role (strictly control admin role)
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'member');
    
    -- Insert the profile (trigger runs as SECURITY DEFINER, bypassing RLS)
    INSERT INTO public.users (
        id, 
        email, 
        name, 
        role, 
        status, 
        membership_status, 
        unique_id, 
        thread_id,
        avatar_url,
        created_at, 
        metadata
    )
    VALUES (
        NEW.id, 
        NEW.email, 
        user_name, 
        user_role, 
        'active', 
        'Pending', 
        unique_user_id,
        COALESCE(NEW.raw_user_meta_data->>'thread_id', gen_random_uuid()::text),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/8.x/initials/svg?seed=' || encode(user_name::bytea, 'escape')),
        NEW.created_at, 
        NEW.raw_user_meta_data
    )
    ON CONFLICT (id) DO UPDATE SET
        -- If profile exists, sync latest data
        email = EXCLUDED.email,
        name = COALESCE(public.users.name, EXCLUDED.name),
        unique_id = COALESCE(public.users.unique_id, EXCLUDED.unique_id),
        updated_at = NOW();

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the auth user creation
        RAISE WARNING 'Failed to sync user profile for %: %', NEW.email, SQLERRM;
        RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 6. Backfill any missing profiles
INSERT INTO public.users (id, email, name, role, status, membership_status, unique_id, thread_id, created_at, metadata)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1), 'User'),
    COALESCE(au.raw_user_meta_data->>'role', 'member'),
    'active',
    'Pending',
    (floor(random() * 9000 + 1000)::text) || (ARRAY['!','@','#','$','%','^','&','*'])[floor(random() * 8 + 1)],
    gen_random_uuid()::text,
    au.created_at,
    au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 7. If admin user exists in auth.users, ensure they have admin role
UPDATE public.users 
SET role = 'admin', status = 'active' 
WHERE email = 'admin@Gymz.com';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
