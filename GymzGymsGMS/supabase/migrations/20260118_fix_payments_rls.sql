-- ============================================
-- FIX PAYMENTS RLS
-- Ensure users can submit and view their own payments
-- ============================================

-- 1. Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 2. Reset Policies
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins manage all payments" ON public.payments;

-- 3. Create Policies

-- Policy A: USERS (Insert)
-- Allow users to submit their own payments
CREATE POLICY "Users can insert own payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy B: USERS (Select)
-- Allow users to view their own payment history
CREATE POLICY "Users can view own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy C: USERS (Update)
-- Allow users to update their own pending payments (e.g. adding transaction reference)
CREATE POLICY "Users can update own payments"
ON public.payments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy D: ADMINS (Full Access)
-- Using the existing check_user_is_admin() or is_admin() helper
CREATE POLICY "Admins manage all payments"
ON public.payments
FOR ALL
TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin')
  OR auth.jwt() ->> 'role' = 'service_role'
);

-- Policy E: SERVICE ROLE (Full Access)
CREATE POLICY "service_role_payments_all"
ON public.payments
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- 4. Reload
NOTIFY pgrst, 'reload schema';
