-- ============================================
-- RESTORE SECURITY (Final Lockdown)
-- ============================================

-- 1. Helper Function to Avoid Recursion
--    (Reads DB as superuser to check if user is admin)
DROP FUNCTION IF EXISTS public.is_admin();
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Reset Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "OPEN ACCESS" ON public.users;
DROP POLICY IF EXISTS "Allow Insert Authenticated" ON public.users;
DROP POLICY IF EXISTS "Allow Select Self" ON public.users;
DROP POLICY IF EXISTS "Allow Update Self" ON public.users;
DROP POLICY IF EXISTS "Allow Admin All" ON public.users;
DROP POLICY IF EXISTS "Admins Full Access" ON public.users;
DROP POLICY IF EXISTS "Members Self Manage" ON public.users;
DROP POLICY IF EXISTS "Allow Signup" ON public.users;

-- 3. Create SECURE Production Policies

-- A. ADMINS: Full Access (Using Safe Function)
CREATE POLICY "Admins Full Access"
ON public.users
FOR ALL
USING (
  public.is_admin() 
  OR 
  auth.jwt() ->> 'role' = 'service_role'
);

-- B. MEMBERS: Read/Update Own Data ONLY
CREATE POLICY "Members Self Manage"
ON public.users
FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- C. INSERTIONS: Allow anyone to INSERT (for Sign Up)
-- But they can only insert their OWN ID.
CREATE POLICY "Allow Signup"
ON public.users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 4. Reload
NOTIFY pgrst, 'reload schema';
