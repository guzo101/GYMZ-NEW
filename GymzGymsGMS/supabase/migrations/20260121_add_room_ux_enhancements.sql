-- Add Female-Friendly and Enhanced UX Fields to Rooms Table
-- This adds fields to support experience levels, community vibes, women-only rooms, and more

DO $$
BEGIN
    -- Add experience_level field (Beginner Friendly, All Levels, Intermediate, Advanced)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='experience_level') THEN
        ALTER TABLE public.rooms ADD COLUMN experience_level TEXT DEFAULT 'All Levels';
        RAISE NOTICE 'Added experience_level column';
    END IF;

    -- Add community_vibe field (Supportive, Competitive, Laid-back)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='community_vibe') THEN
        ALTER TABLE public.rooms ADD COLUMN community_vibe TEXT DEFAULT 'Supportive';
        RAISE NOTICE 'Added community_vibe column';
    END IF;

    -- Add is_women_only field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='is_women_only') THEN
        ALTER TABLE public.rooms ADD COLUMN is_women_only BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_women_only column';
    END IF;

    -- Add active_level field (Daily Active, Weekly Check-ins, Casual)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='active_level') THEN
        ALTER TABLE public.rooms ADD COLUMN active_level TEXT DEFAULT 'Daily Active';
        RAISE NOTICE 'Added active_level column';
    END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
