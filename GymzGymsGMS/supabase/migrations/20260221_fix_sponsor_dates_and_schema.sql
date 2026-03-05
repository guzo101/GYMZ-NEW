-- Migration: Add scheduling and audience to banner_ads + Reload Schema Cache

BEGIN;

-- 1. Add missing columns to banner_ads
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='banner_ads' AND column_name='audience_type') THEN
        ALTER TABLE public.banner_ads ADD COLUMN audience_type TEXT NOT NULL DEFAULT 'all'
            CHECK (audience_type IN ('all', 'gym_members', 'event_members'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='banner_ads' AND column_name='start_date') THEN
        ALTER TABLE public.banner_ads ADD COLUMN start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='banner_ads' AND column_name='end_date') THEN
        ALTER TABLE public.banner_ads ADD COLUMN end_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 2. Ensure events table image_url is definitely recognized
-- We rewrite the columns implicitly by adding an index or just a comment to trigger cache invalidation
COMMENT ON COLUMN public.events.image_url IS 'Publicly accessible URL for the event banner image';

-- 3. FORCE SCHEMA RELOAD
-- This is the most important part for the "Could not find column" error
NOTIFY pgrst, 'reload schema';

COMMIT;
