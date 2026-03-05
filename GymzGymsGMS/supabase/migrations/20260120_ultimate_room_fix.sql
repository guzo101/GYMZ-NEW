-- ULTIMATE FIX FOR ROOMS TABLE AND RLS
-- This migration ensures the table 'rooms' is perfectly consistent and RLS is bulletproof.

DO $$
BEGIN
    -- 1. Ensure Table Name is 'rooms'
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'looms' AND table_schema = 'public') THEN
        ALTER TABLE public.looms RENAME TO rooms;
    END IF;

    -- 2. Ensure All Columns Exist and have correct types
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

    -- rules
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='rules') THEN
        ALTER TABLE public.rooms ADD COLUMN rules TEXT DEFAULT 'Welcome!';
    END IF;

    -- admin_id (UUID)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='admin_id') THEN
        ALTER TABLE public.rooms ADD COLUMN admin_id UUID REFERENCES public.users(id);
    END IF;
END $$;

-- 3. REPAIR DATA: Ensure every room has an admin_id
-- If admin_id is null, we assign it to the first user found in room_members for that room.
UPDATE public.rooms r
SET admin_id = (
    SELECT user_id 
    FROM public.room_members m 
    WHERE m.room_id = r.id 
    ORDER BY joined_at ASC 
    LIMIT 1
)
WHERE r.admin_id IS NULL;

-- 4. REBUILD RLS POLICIES (Bulletproof)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Clear all existing policies to avoid legacy overlaps
DROP POLICY IF EXISTS "Anyone can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Authenticated users can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Room Admins or Global Admins can update rooms" ON public.rooms;
DROP POLICY IF EXISTS "Room Admins or Global Admins can delete rooms" ON public.rooms;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.rooms;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.rooms;
DROP POLICY IF EXISTS "Room Admins can update their rooms" ON public.rooms;

-- SELECT: Anyone can view active rooms
CREATE POLICY "Anyone can view rooms" ON public.rooms 
FOR SELECT USING (true);

-- INSERT: Authenticated users can create rooms and set themselves as admin
CREATE POLICY "Authenticated users can create rooms" ON public.rooms 
FOR INSERT WITH CHECK (auth.uid() = admin_id);

-- UPDATE: Room Creator OR Global Admin can update
CREATE POLICY "Room Admins or Global Admins can update rooms" ON public.rooms 
FOR UPDATE USING (
    auth.uid() = admin_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
    auth.uid() = admin_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- DELETE: Room Creator or Global Admin can delete
CREATE POLICY "Room Admins or Global Admins can delete rooms" ON public.rooms 
FOR DELETE USING (
    auth.uid() = admin_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 5. RELOAD POSTGREST
NOTIFY pgrst, 'reload schema';
