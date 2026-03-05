-- ==========================================
-- ADMIN ROOM PRIVILEGES MIGRATION
-- Enables global admins to manage all aspects of rooms
-- ==========================================

-- 1. Updates for 'room_members'
DROP POLICY IF EXISTS "Anyone can view room members" ON public.room_members;
CREATE POLICY "Anyone can view room members" ON public.room_members 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins or members can remove people" ON public.room_members;
CREATE POLICY "Admins or members can remove people" ON public.room_members 
FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 2. Updates for 'room_posts'
DROP POLICY IF EXISTS "Members of a room can view posts" ON public.room_posts;
CREATE POLICY "Members of a room can view posts" ON public.room_posts 
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.room_members WHERE user_id = auth.uid() AND room_id = public.room_posts.room_id) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Members of a room can create posts" ON public.room_posts;
CREATE POLICY "Members of a room can create posts" ON public.room_posts 
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.room_members WHERE user_id = auth.uid() AND room_id = public.room_posts.room_id) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admins or owners can delete posts" ON public.room_posts;
CREATE POLICY "Admins or owners can delete posts" ON public.room_posts 
FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Updates for 'room_post_reactions'
DROP POLICY IF EXISTS "Members of a room can view reactions" ON public.room_post_reactions;
CREATE POLICY "Members of a room can view reactions" ON public.room_post_reactions 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.room_posts p
        LEFT JOIN public.room_members m ON p.room_id = m.room_id
        WHERE p.id = public.room_post_reactions.post_id 
        AND (m.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
    )
);

DROP POLICY IF EXISTS "Members of a room can react to posts" ON public.room_post_reactions;
CREATE POLICY "Members of a room can react to posts" ON public.room_post_reactions 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.room_posts p
        LEFT JOIN public.room_members m ON p.room_id = m.room_id
        WHERE p.id = public.room_post_reactions.post_id 
        AND (m.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
    )
);

-- 4. Updates for 'room_post_comments'
DROP POLICY IF EXISTS "Members of a room can view comments" ON public.room_post_comments;
CREATE POLICY "Members of a room can view comments" ON public.room_post_comments 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.room_posts p
        LEFT JOIN public.room_members m ON p.room_id = m.room_id
        WHERE p.id = public.room_post_comments.post_id 
        AND (m.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
    )
);

DROP POLICY IF EXISTS "Members of a room can comment on posts" ON public.room_post_comments;
CREATE POLICY "Members of a room can comment on posts" ON public.room_post_comments 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.room_posts p
        LEFT JOIN public.room_members m ON p.room_id = m.room_id
        WHERE p.id = public.room_post_comments.post_id 
        AND (m.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
    )
);

DROP POLICY IF EXISTS "Admins or owners can delete comments" ON public.room_post_comments;
CREATE POLICY "Admins or owners can delete comments" ON public.room_post_comments 
FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

NOTIFY pgrst, 'reload schema';
