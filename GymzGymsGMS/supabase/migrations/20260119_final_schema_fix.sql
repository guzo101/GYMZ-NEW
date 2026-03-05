-- FINAL SCHEMA FIX & CACHE RELOAD
-- This ensures the columns exist and forces Supabase to refresh its internal cache

-- 1. Ensure columns exist with correct types
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS membership_expiry DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS renewal_due_date DATE;

-- 2. Ensure they are nullable (just in case)
ALTER TABLE public.users ALTER COLUMN membership_expiry DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN renewal_due_date DROP NOT NULL;

-- 3. Grant permissions (just in case they were restricted)
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.users TO anon;

-- 4. FORCE CACHE RELOAD (Multiple methods)
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');

-- 5. Verify script completion
DO $$ 
BEGIN 
    RAISE NOTICE 'Schema fix and reload completed successfully.';
END $$;
