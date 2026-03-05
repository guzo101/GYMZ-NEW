-- 1. FORCE CLEANUP: Drop tables to ensure we start fresh
DROP TABLE IF EXISTS public.loom_post_comments CASCADE;
DROP TABLE IF EXISTS public.loom_post_reactions CASCADE;
DROP TABLE IF EXISTS public.loom_posts CASCADE;
DROP TABLE IF EXISTS public.loom_members CASCADE;
DROP TABLE IF EXISTS public.looms CASCADE;

-- 2. SETUP EXTENSION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. CREATE MAIN TABLE
CREATE TABLE public.looms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    goal TEXT,
    rules TEXT,
    admin_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE
);

-- 4. CREATE MEMBERS TABLE
CREATE TABLE public.loom_members (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    loom_id UUID REFERENCES public.looms(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ENABLE RLS (Security)
ALTER TABLE public.looms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loom_members ENABLE ROW LEVEL SECURITY;

-- 6. CREATE POLICIES (Permissions)
-- Looms: Everyone can see, Users can create
CREATE POLICY "Enable read access for all users" ON public.looms FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.looms FOR INSERT WITH CHECK (auth.uid() = admin_id);

-- Members: Everyone can see, Users can join
CREATE POLICY "Enable read access for all members" ON public.loom_members FOR SELECT USING (true);
CREATE POLICY "Enable insert for users joining" ON public.loom_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. REFRESH API CACHE
NOTIFY pgrst, 'reload schema';
