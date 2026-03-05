-- DEFINITIVE FIX FOR PAYMENT RLS
-- This script ensures ANY authenticated user can insert a payment for themselves.
-- It strictly handles the "new row violates row-level security" error.

-- 1. Reset Policies on Payments (Clean Slate)
DROP POLICY IF EXISTS "Users Insert Own Payments" ON public.payments;
DROP POLICY IF EXISTS "Users View Own Payments" ON public.payments;
DROP POLICY IF EXISTS "Users Update Own Payments" ON public.payments;
DROP POLICY IF EXISTS "Admins Full Access" ON public.payments;

-- 2. Create the "Permissive Insert" Policy
-- "If you are logged in, you can pay." - Simple as that.
CREATE POLICY "Users Insert Own Payments"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

-- 3. Create the "View Own" Policy
CREATE POLICY "Users View Own Payments"
ON public.payments FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);

-- 4. Create the "Update Own" Policy (for transaction refs)
CREATE POLICY "Users Update Own Payments"
ON public.payments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Admin Policy
CREATE POLICY "Admins Manage All"
ON public.payments FOR ALL
TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin')
  OR auth.jwt()->>'role' = 'service_role'
);

-- 6. Ensure RLS is actually ON
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 7. Grant permissions
GRANT ALL ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
