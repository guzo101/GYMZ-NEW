-- ============================================
-- SIMPLIFIED POLICIES - "LET PEOPLE IN"
-- ============================================

-- 1. Reset RLS on Users Table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Drop Function-Based Policies (Complexity Sources)
DROP POLICY IF EXISTS "Admins Full Access" ON public.users;
DROP POLICY IF EXISTS "Admins manage all" ON public.users;
DROP POLICY IF EXISTS "Users Self Manage" ON public.users;
DROP POLICY IF EXISTS "Users manage own profile" ON public.users;

-- 3. Create SIMPLE Policies

-- ALLOW INSERT: Let anyone who is logged in create a row
-- (Crucial for Sign Up)
CREATE POLICY "Allow Insert Authenticated"
ON public.users
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- ALLOW SELF-SELECT: Users view themselves
CREATE POLICY "Allow Select Self"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- ALLOW SELF-UPDATE: Users update themselves
CREATE POLICY "Allow Update Self"
ON public.users
FOR UPDATE
USING (auth.uid() = id);

-- ALLOW ADMIN ALL: Hardcoded Admin Access
-- (Bypassing functions for now to be safe)
CREATE POLICY "Allow Admin All"
ON public.users
FOR ALL
USING (
  auth.jwt() ->> 'role' = 'service_role' 
  OR 
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin')
);

-- 4. Reload
NOTIFY pgrst, 'reload schema';
