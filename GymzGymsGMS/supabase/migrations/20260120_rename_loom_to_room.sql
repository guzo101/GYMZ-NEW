-- 1. Rename Tables safely
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'looms' AND table_schema = 'public') THEN
        ALTER TABLE public.looms RENAME TO rooms;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loom_members' AND table_schema = 'public') THEN
        ALTER TABLE public.loom_members RENAME TO room_members;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loom_posts' AND table_schema = 'public') THEN
        ALTER TABLE public.loom_posts RENAME TO room_posts;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loom_post_reactions' AND table_schema = 'public') THEN
        ALTER TABLE public.loom_post_reactions RENAME TO room_post_reactions;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loom_post_comments' AND table_schema = 'public') THEN
        ALTER TABLE public.loom_post_comments RENAME TO room_post_comments;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'loom_achievements' AND table_schema = 'public') THEN
        ALTER TABLE public.loom_achievements RENAME TO room_achievements;
    END IF;
END $$;

-- 2. Rename Columns safely
DO $$
BEGIN
    -- room_members
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_members' AND column_name='loom_id') THEN
        ALTER TABLE public.room_members RENAME COLUMN loom_id TO room_id;
    END IF;

    -- room_posts
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_posts' AND column_name='loom_id') THEN
        ALTER TABLE public.room_posts RENAME COLUMN loom_id TO room_id;
    END IF;

    -- room_achievements
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_achievements' AND column_name='loom_id') THEN
        ALTER TABLE public.room_achievements RENAME COLUMN loom_id TO room_id;
    END IF;

    -- users: loom_notifications -> room_notifications
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='loom_notifications') THEN
        ALTER TABLE public.users RENAME COLUMN loom_notifications TO room_notifications;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='room_notifications') THEN
        ALTER TABLE public.users ADD COLUMN room_notifications JSONB DEFAULT '{"posts": true, "milestones": true, "weekly": true}';
    END IF;
END $$;

-- 3. Update RLS Policies safely
DO $$
BEGIN
    -- Rooms
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rooms' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Anyone can view looms" ON public.rooms;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rooms' AND policyname = 'Anyone can view rooms') THEN
            CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (true);
        END IF;

        DROP POLICY IF EXISTS "Authenticated users can create looms" ON public.rooms;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rooms' AND policyname = 'Authenticated users can create rooms') THEN
            CREATE POLICY "Authenticated users can create rooms" ON public.rooms FOR INSERT WITH CHECK (auth.uid() = admin_id);
        END IF;

        DROP POLICY IF EXISTS "Loom Admins can update their looms" ON public.rooms;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rooms' AND policyname = 'Room Admins can update their rooms') THEN
            CREATE POLICY "Room Admins can update their rooms" ON public.rooms FOR UPDATE USING (auth.uid() = admin_id);
        END IF;
    END IF;

    -- Room Members
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_members' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Anyone can view loom members" ON public.room_members;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_members' AND policyname = 'Anyone can view room members') THEN
            CREATE POLICY "Anyone can view room members" ON public.room_members FOR SELECT USING (true);
        END IF;

        DROP POLICY IF EXISTS "Members can join looms" ON public.room_members;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_members' AND policyname = 'Members can join rooms') THEN
            CREATE POLICY "Members can join rooms" ON public.room_members FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;

        DROP POLICY IF EXISTS "Members can leave looms" ON public.room_members;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_members' AND policyname = 'Members can leave rooms') THEN
            CREATE POLICY "Members can leave rooms" ON public.room_members FOR DELETE USING (auth.uid() = user_id);
        END IF;
    END IF;

    -- Room Posts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_posts' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Members of a loom can view posts" ON public.room_posts;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_posts' AND policyname = 'Members of a room can view posts') THEN
            CREATE POLICY "Members of a room can view posts" ON public.room_posts FOR SELECT USING (
                EXISTS (SELECT 1 FROM public.room_members WHERE user_id = auth.uid() AND room_id = public.room_posts.room_id)
            );
        END IF;

        DROP POLICY IF EXISTS "Members of a loom can create posts" ON public.room_posts;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_posts' AND policyname = 'Members of a room can create posts') THEN
            CREATE POLICY "Members of a room can create posts" ON public.room_posts FOR INSERT WITH CHECK (
                EXISTS (SELECT 1 FROM public.room_members WHERE user_id = auth.uid() AND room_id = public.room_posts.room_id)
            );
        END IF;
    END IF;

    -- Post Reactions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_post_reactions' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Members of a loom can view reactions" ON public.room_post_reactions;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_post_reactions' AND policyname = 'Members of a room can view reactions') THEN
            CREATE POLICY "Members of a room can view reactions" ON public.room_post_reactions FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.room_posts p
                    JOIN public.room_members m ON p.room_id = m.room_id
                    WHERE p.id = public.room_post_reactions.post_id AND m.user_id = auth.uid()
                )
            );
        END IF;

        DROP POLICY IF EXISTS "Members of a loom can react to posts" ON public.room_post_reactions;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_post_reactions' AND policyname = 'Members of a room can react to posts') THEN
            CREATE POLICY "Members of a room can react to posts" ON public.room_post_reactions FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.room_posts p
                    JOIN public.room_members m ON p.room_id = m.room_id
                    WHERE p.id = public.room_post_reactions.post_id AND m.user_id = auth.uid()
                )
            );
        END IF;
    END IF;

    -- Post Comments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_post_comments' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Members of a loom can view comments" ON public.room_post_comments;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_post_comments' AND policyname = 'Members of a room can view comments') THEN
            CREATE POLICY "Members of a room can view comments" ON public.room_post_comments FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.room_posts p
                    JOIN public.room_members m ON p.room_id = m.room_id
                    WHERE p.id = public.room_post_comments.post_id AND m.user_id = auth.uid()
                )
            );
        END IF;

        DROP POLICY IF EXISTS "Members of a loom can comment on posts" ON public.room_post_comments;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_post_comments' AND policyname = 'Members of a room can comment on posts') THEN
            CREATE POLICY "Members of a room can comment on posts" ON public.room_post_comments FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.room_posts p
                    JOIN public.room_members m ON p.room_id = m.room_id
                    WHERE p.id = public.room_post_comments.post_id AND m.user_id = auth.uid()
                )
            );
        END IF;
    END IF;

    -- Achievements
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_achievements' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Anyone can view achievements" ON public.room_achievements;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_achievements' AND policyname = 'Anyone can view achievements') THEN
            CREATE POLICY "Anyone can view achievements" ON public.room_achievements FOR SELECT USING (true);
        END IF;

        DROP POLICY IF EXISTS "System can insert achievements" ON public.room_achievements;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'room_achievements' AND policyname = 'System can insert achievements') THEN
            CREATE POLICY "System can insert achievements" ON public.room_achievements FOR INSERT WITH CHECK (true);
        END IF;
    END IF;
END $$;

-- Re-sync schema
NOTIFY pgrst, 'reload schema';
