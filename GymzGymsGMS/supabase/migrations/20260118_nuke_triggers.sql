-- ============================================
-- NUKE TRIGGERS & FIX AUTH
-- ============================================

-- 1. DROP THE TRIGGER (Forcefully)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. RESET POLICIES (Make it wide open for test)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OPEN ACCESS" ON public.users
FOR ALL USING (true) WITH CHECK (true);

-- 3. RELOAD
NOTIFY pgrst, 'reload schema';
