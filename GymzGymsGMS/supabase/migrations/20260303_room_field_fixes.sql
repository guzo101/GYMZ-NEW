-- ==========================================
-- ROOMS AND ROOM MEMBERS SCHEMA FIXES
-- ==========================================

DO $$
BEGIN
    -- 1. Ensure UX enhancement columns exist in 'public.rooms'
    
    -- active_level (Daily Active, Weekly Check-ins, Casual)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='active_level') THEN
        ALTER TABLE public.rooms ADD COLUMN active_level TEXT DEFAULT 'Daily Active';
        RAISE NOTICE 'Added active_level column to rooms';
    END IF;

    -- experience_level (Beginner Friendly, All Levels, Intermediate, Advanced)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='experience_level') THEN
        ALTER TABLE public.rooms ADD COLUMN experience_level TEXT DEFAULT 'All Levels';
        RAISE NOTICE 'Added experience_level column to rooms';
    END IF;

    -- community_vibe (Supportive, Competitive, Laid-back)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='community_vibe') THEN
        ALTER TABLE public.rooms ADD COLUMN community_vibe TEXT DEFAULT 'Supportive';
        RAISE NOTICE 'Added community_vibe column to rooms';
    END IF;

    -- is_women_only
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='is_women_only') THEN
        ALTER TABLE public.rooms ADD COLUMN is_women_only BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_women_only column to rooms';
    END IF;

    -- 2. Harmonize 'public.room_members' table
    
    -- Ensure 'created_at' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_members' AND column_name='created_at') THEN
        -- If joined_at exists, we use it as the base
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='room_members' AND column_name='joined_at') THEN
            ALTER TABLE public.room_members ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            UPDATE public.room_members SET created_at = joined_at;
            RAISE NOTICE 'Added created_at to room_members and synced from joined_at';
        ELSE
            ALTER TABLE public.room_members ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            RAISE NOTICE 'Added created_at to room_members';
        END IF;
    END IF;

END $$;

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
