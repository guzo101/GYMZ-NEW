-- RESTORATION & SYNC SCRIPT
-- Purpose: Bring back all users from auth.users to public.users and ensure they appear in GMS.

-- 1. Ensure the generation function exists
CREATE OR REPLACE FUNCTION public.generate_unique_user_id_v2()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT (floor(random() * 9000 + 1000)::text) || (ARRAY['!','@','#','$','%','^','&','*'])[floor(random() * 8 + 1)];
$$;

-- 2. BACKFILL ALL MISSING USERS
-- This will recreate profiles for everyone in auth.users who is missing from public.users
INSERT INTO public.users (
    id, 
    email, 
    name, 
    role, 
    membership_status, 
    status, 
    unique_id, 
    thread_id, 
    created_at, 
    metadata
)
SELECT 
    au.id, 
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1), 'User'),
    COALESCE(au.raw_user_meta_data->>'role', 'member'),
    COALESCE(au.raw_user_meta_data->>'membership_status', 'Pending'),
    'active',
    COALESCE(au.raw_user_meta_data->>'unique_id', public.generate_unique_user_id_v2()),
    COALESCE(au.raw_user_meta_data->>'thread_id', gen_random_uuid()::text),
    au.created_at,
    au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(public.users.name, EXCLUDED.name);

-- 3. ENSURE ALL IDS ARE POPULATED
-- (Existing users might have mission unique_ids or thread_ids)
UPDATE public.users SET unique_id = public.generate_unique_user_id_v2() WHERE unique_id IS NULL;
UPDATE public.users SET thread_id = gen_random_uuid()::text WHERE thread_id IS NULL;

-- 4. FIX GMS VISIBILITY (Policies)
-- Ensure Admins and Service Role have total visibility
DROP POLICY IF EXISTS "Ultimate Access" ON public.users;
DROP POLICY IF EXISTS "GMS Admin Access" ON public.users;

-- Policy 1: Everyone who is logged in can see their own
CREATE POLICY "Users view self" ON public.users FOR SELECT TO authenticated USING (auth.uid() = id);

-- Policy 2: Admins can see EVERYTHING
CREATE POLICY "Admins view all" ON public.users FOR SELECT TO authenticated 
USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin')
    OR (auth.jwt()->>'role' = 'service_role')
);

-- Policy 3: Service role can do everything
CREATE POLICY "Service bypass everything" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. RELOAD
NOTIFY pgrst, 'reload schema';
