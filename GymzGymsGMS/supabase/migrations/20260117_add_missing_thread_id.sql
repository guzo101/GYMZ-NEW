-- ============================================
-- FIX MISSING COLUMNS & RELOAD SCHEMA
-- ============================================

-- 1. Add thread_id if it's missing (Critical for AI features)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS thread_id TEXT;

-- 2. Add correct index for performance
CREATE UNIQUE INDEX IF NOT EXISTS users_thread_id_idx 
ON public.users(thread_id) 
WHERE thread_id IS NOT NULL;

-- 3. Force Supabase/PostgREST to refresh its schema cache
-- This fixes the "Could not find column in schema cache" error
NOTIFY pgrst, 'reload schema';

-- 4. Verify/Fix other potential missing columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS goal TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS height TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weight TEXT;

-- 5. Grant permissions again just in case
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;
GRANT SELECT ON TABLE public.users TO anon;
