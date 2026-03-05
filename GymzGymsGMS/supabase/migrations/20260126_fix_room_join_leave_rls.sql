-- ==========================================
-- FIX ROOM JOIN/LEAVE RLS POLICIES
-- ==========================================

-- 1. Ensure "room_members" has correct policies
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- Allow users to JOIN (Insert their own record)
DROP POLICY IF EXISTS "Members can join rooms" ON public.room_members;
CREATE POLICY "Members can join rooms" ON public.room_members 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to LEAVE (Delete their own record)
-- Also allows Admins to remove members (Reinforcing previous policy)
DROP POLICY IF EXISTS "Members can leave or Admins can remove" ON public.room_members;
CREATE POLICY "Members can leave or Admins can remove" ON public.room_members 
FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Allow VIEWing members (needed for UI to see who is in a room)
DROP POLICY IF EXISTS "Anyone can view room members" ON public.room_members;
CREATE POLICY "Anyone can view room members" ON public.room_members 
FOR SELECT USING (true);

-- 2. Notify schema reload
NOTIFY pgrst, 'reload schema';
