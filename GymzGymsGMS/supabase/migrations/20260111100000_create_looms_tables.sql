-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Looms feature migration

-- Looms table
CREATE TABLE IF NOT EXISTS public.looms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    goal TEXT,
    rules TEXT,
    admin_id UUID REFERENCES public.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE
);

-- Loom Members table
CREATE TABLE IF NOT EXISTS public.loom_members (
    loom_id UUID REFERENCES public.looms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id) -- Ensures a member can belong to ONLY ONE loom at any time
);

-- Loom Posts table
CREATE TABLE IF NOT EXISTS public.loom_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loom_id UUID REFERENCES public.looms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT,
    type TEXT DEFAULT 'text', -- 'text' or 'progress'
    progress_data JSONB, -- For workout progress updates
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loom Post Reactions
CREATE TABLE IF NOT EXISTS public.loom_post_reactions (
    post_id UUID REFERENCES public.loom_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'like',
    PRIMARY KEY (post_id, user_id)
);

-- Loom Post Comments
CREATE TABLE IF NOT EXISTS public.loom_post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES public.loom_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.looms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loom_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loom_post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loom_post_comments ENABLE ROW LEVEL SECURITY;

-- Looms Visibility
DO $$ BEGIN
    CREATE POLICY "Anyone can view looms" ON public.looms FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated users can create looms" ON public.looms FOR INSERT WITH CHECK (auth.uid() = admin_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Loom Admins can update their looms" ON public.looms FOR UPDATE USING (auth.uid() = admin_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Loom Members
DO $$ BEGIN
    CREATE POLICY "Anyone can view loom members" ON public.loom_members FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Members can join looms" ON public.loom_members FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Members can leave looms" ON public.loom_members FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Loom Posts
DO $$ BEGIN
    CREATE POLICY "Members of a loom can view posts" ON public.loom_posts FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.loom_members WHERE user_id = auth.uid() AND loom_id = public.loom_posts.loom_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Members of a loom can create posts" ON public.loom_posts FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.loom_members WHERE user_id = auth.uid() AND loom_id = public.loom_posts.loom_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Post Reactions
DO $$ BEGIN
    CREATE POLICY "Members of a loom can view reactions" ON public.loom_post_reactions FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.loom_posts p
            JOIN public.loom_members m ON p.loom_id = m.loom_id
            WHERE p.id = public.loom_post_reactions.post_id AND m.user_id = auth.uid()
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Members of a loom can react to posts" ON public.loom_post_reactions FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.loom_posts p
            JOIN public.loom_members m ON p.loom_id = m.loom_id
            WHERE p.id = public.loom_post_reactions.post_id AND m.user_id = auth.uid()
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Post Comments
DO $$ BEGIN
    CREATE POLICY "Members of a loom can view comments" ON public.loom_post_comments FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.loom_posts p
            JOIN public.loom_members m ON p.loom_id = m.loom_id
            WHERE p.id = public.loom_post_comments.post_id AND m.user_id = auth.uid()
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Members of a loom can comment on posts" ON public.loom_post_comments FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.loom_posts p
            JOIN public.loom_members m ON p.loom_id = m.loom_id
            WHERE p.id = public.loom_post_comments.post_id AND m.user_id = auth.uid()
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
