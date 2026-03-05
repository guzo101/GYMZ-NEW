-- COMPREHENSIVE SCHEMA FIX
-- Ensure all columns used in Members.tsx and Finances.tsx exist on public.users

-- 1. Add missing date columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS membership_expiry DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS renewal_due_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_payment_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS join_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_duration_months numeric;

-- 2. Ensure they are nullable
ALTER TABLE public.users ALTER COLUMN membership_expiry DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN renewal_due_date DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN last_payment_date DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN join_date DROP NOT NULL;

-- 3. Sync 'join_date' if it's null (using created_at as backup)
UPDATE public.users SET join_date = created_at::date WHERE join_date IS NULL;

-- 4. Re-grant permissions to be absolutely sure
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.users TO anon;

-- 5. Force cache reload
NOTIFY pgrst, 'reload schema';

DO $$ 
BEGIN 
    RAISE NOTICE 'Comprehensive schema fix completed.';
END $$;
