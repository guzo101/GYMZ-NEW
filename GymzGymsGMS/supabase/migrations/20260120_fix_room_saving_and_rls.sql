-- FINAL FIX FOR ROOMS TABLE AND RLS
-- This migration ensures the table 'rooms' is correctly set up and RLS policies are robust.

DO $$
BEGIN
    -- 1. Ensure Table Name is 'rooms'
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'looms' AND table_schema = 'public') THEN
        ALTER TABLE public.looms RENAME TO rooms;
    END IF;

    -- 2. Ensure Columns Exist
    -- max_members
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='max_members') THEN
        ALTER TABLE public.rooms ADD COLUMN max_members INTEGER DEFAULT 50;
    END IF;

    -- duration_days
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='duration_days') THEN
        ALTER TABLE public.rooms ADD COLUMN duration_days INTEGER DEFAULT 60;
    END IF;

    -- start_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='start_date') THEN
        ALTER TABLE public.rooms ADD COLUMN start_date DATE DEFAULT CURRENT_DATE;
    END IF;

    -- goal
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='goal') THEN
        ALTER TABLE public.rooms ADD COLUMN goal TEXT;
    END IF;

    -- description
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='description') THEN
        ALTER TABLE public.rooms ADD COLUMN description TEXT;
    END IF;

    -- admin_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='admin_id') THEN
        ALTER TABLE public.rooms ADD COLUMN admin_id UUID REFERENCES public.users(id);
    END IF;
END $$;

-- 3. Reset and Rebuild RLS Policies for 'rooms'
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Room Admins can update their rooms" ON public.rooms;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.rooms;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.rooms;

-- SELECT: Anyone can view active rooms
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (true);

-- INSERT: Authenticated users can create rooms and set themselves as admin
CREATE POLICY "Authenticated users can create rooms" ON public.rooms FOR INSERT WITH CHECK (auth.uid() = admin_id);

-- UPDATE: Room Creator OR Global Admin can update
-- We check public.users for the 'admin' role to allow global admins to manage communities.
CREATE POLICY "Room Admins or Global Admins can update rooms" ON public.rooms FOR UPDATE USING (
    auth.uid() = admin_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
    auth.uid() = admin_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- DELETE: Room Creator or Global Admin can delete
CREATE POLICY "Room Admins or Global Admins can delete rooms" ON public.rooms FOR DELETE USING (
    auth.uid() = admin_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

NOTIFY pgrst, 'reload schema';
