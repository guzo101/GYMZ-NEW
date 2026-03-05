-- EMERGENCY FIX: Payments RLS is blocking legitimate user inserts
-- This completely rebuilds the RLS policies for payments table

-- 1. Drop ALL existing policies on payments
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins manage all payments" ON public.payments;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.payments;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.payments;

-- 2. Temporarily disable RLS to test (REMOVE THIS LATER)
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- 3. Re-enable RLS with CORRECT policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 4. Create SIMPLE, WORKING policies
-- Policy A: Users can insert payments where user_id OR member_id matches their ID
CREATE POLICY "Users Insert Own Payments"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  OR 
  auth.uid() = member_id
);

-- Policy B: Users can view their own payments
CREATE POLICY "Users View Own Payments"
ON public.payments FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  auth.uid() = member_id
);

-- Policy C: Users can update their own payments
CREATE POLICY "Users Update Own Payments"
ON public.payments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = member_id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = member_id);

-- Policy D: Admins and service_role can do everything
CREATE POLICY "Admins Full Access"
ON public.payments FOR ALL
TO authenticated
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin')
  OR
  auth.jwt()->>'role' = 'service_role'
);

-- 5. Grant necessary permissions
GRANT ALL ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

-- 6. Reload schema
NOTIFY pgrst, 'reload schema';
