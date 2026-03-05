-- 1. NUCLEAR RESET: Clear all data to ensure no "Ghost" memberships blocking creation
TRUNCATE TABLE public.loom_members CASCADE;
TRUNCATE TABLE public.looms CASCADE;

-- 2. RELAX POLICIES: Make everything fully public for debugging
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.looms;
DROP POLICY IF EXISTS "Enable insert for users joining" ON public.loom_members;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.looms;
DROP POLICY IF EXISTS "Enable read access for all members" ON public.loom_members;

-- Allow ANYONE (including anon) to Insert/Select/Update/Delete
CREATE POLICY "Debug: Allow All Looms" ON public.looms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Debug: Allow All Members" ON public.loom_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Debug: Allow All Posts" ON public.loom_posts FOR ALL USING (true) WITH CHECK (true);

-- 3. REFRESH CACHE
NOTIFY pgrst, 'reload schema';
