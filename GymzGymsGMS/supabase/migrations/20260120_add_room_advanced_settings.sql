-- Add advanced settings to rooms table
DO $$
BEGIN
    -- Add max_members if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='max_members') THEN
        ALTER TABLE public.rooms ADD COLUMN max_members INTEGER DEFAULT 50;
    END IF;

    -- Add duration_days if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='duration_days') THEN
        ALTER TABLE public.rooms ADD COLUMN duration_days INTEGER DEFAULT 60;
    END IF;

    -- Add start_date if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='start_date') THEN
        ALTER TABLE public.rooms ADD COLUMN start_date DATE DEFAULT CURRENT_DATE;
    END IF;
END $$;
