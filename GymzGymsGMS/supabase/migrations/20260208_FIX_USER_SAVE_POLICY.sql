-- Migration: FIX USER SAVE POLICY
-- Date: 2026-02-08
-- Purpose: Restore UPDATE permissions for users on their own records and ensure first_name/last_name exist.

BEGIN;

-- 1. Ensure columns exist (Defensive)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. Restore RLS Update Policy
DROP POLICY IF EXISTS "table_users_update_self" ON public.users;
CREATE POLICY "table_users_update_self" ON public.users 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. Ensure INSERT policy exists for onboarding (if missing)
DROP POLICY IF EXISTS "table_users_insert_self" ON public.users;
CREATE POLICY "table_users_insert_self" ON public.users 
FOR INSERT 
WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

-- 4. Reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;
