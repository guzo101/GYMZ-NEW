-- ============================================
-- COMPREHENSIVE AUTH FIX - January 2026
-- Addresses all potential authentication issues
-- ============================================

-- 0. PRE-REQUISITE: Ensure columns exist BEFORE we try to use them
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS membership_status TEXT DEFAULT 'Pending';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Update existing NULLs to defaults
UPDATE public.users SET status = 'active' WHERE status IS NULL;
UPDATE public.users SET membership_status = 'Pending' WHERE membership_status IS NULL;

-- 1. Ensure the trigger function uses the correct fields
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
    user_role TEXT := 'member';
BEGIN
    -- Extract name with fallbacks
    user_name := COALESCE(
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'full_name',
        split_part(new.email, '@', 1),
        'User'
    );

    -- Insert into public.users
    INSERT INTO public.users (
        id, 
        email, 
        name, 
        role, 
        membership_status,
        status,
        created_at,
        metadata
    )
    VALUES (
        new.id, 
        new.email, 
        user_name, 
        user_role, 
        'Pending',  -- membership_status for payment tracking
        'active',   -- status for login access
        new.created_at,
        new.raw_user_meta_data
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        name = COALESCE(public.users.name, EXCLUDED.name),
        metadata = COALESCE(public.users.metadata, EXCLUDED.metadata),
        updated_at = NOW();

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Backfill any missing users
INSERT INTO public.users (id, email, name, role, membership_status, status, created_at, metadata)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    'member',
    'Pending',
    'active',
    au.created_at,
    au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
  AND au.email_confirmed_at IS NOT NULL  -- Only sync confirmed users
ON CONFLICT (id) DO NOTHING;

-- 4. RLS Policies - Ensure users can read their own data
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Service role can do anything" ON public.users;

-- Create policies
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Service role can do anything"
  ON public.users
  USING (auth.role() = 'service_role');

-- 5. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.users TO service_role;
GRANT SELECT, UPDATE ON TABLE public.users TO authenticated;
GRANT SELECT ON TABLE public.users TO anon;

-- 6. Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_membership_status ON public.users(membership_status);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
