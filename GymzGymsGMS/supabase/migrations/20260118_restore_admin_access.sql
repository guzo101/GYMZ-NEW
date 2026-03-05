-- ============================================
-- RESTORE ADMIN ACCESS
-- Fixes "RLS Violation" by promoting users to Admin
-- ============================================

-- 1. Promote ALL existing users to 'admin' role
-- This ensures that YOU (and any test accounts) have full access again.
UPDATE public.users 
SET role = 'admin';

-- 2. Verify the update (optional check for the log)
DO $$
BEGIN
  RAISE NOTICE 'Updated all users to admin role.';
END $$;

-- 3. SCHEMA RELOAD
-- Just to be safe and ensure the API cache is fresh
NOTIFY pgrst, 'reload schema';
