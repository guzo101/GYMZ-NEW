-- ============================================
-- SAFEGUARD: ADD MISSING NOTIFICATION COLUMNS
-- This ensures the system works even if the table already existed
-- ============================================

DO $$
BEGIN
    -- 1. priority
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'priority') THEN
        ALTER TABLE public.notifications ADD COLUMN priority INTEGER DEFAULT 3;
    END IF;

    -- 2. status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'status') THEN
        ALTER TABLE public.notifications ADD COLUMN status TEXT DEFAULT 'unread';
    END IF;

    -- 3. platform_origin
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'platform_origin') THEN
        ALTER TABLE public.notifications ADD COLUMN platform_origin TEXT DEFAULT 'gms';
    END IF;

    -- 4. action_label
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'action_label') THEN
        ALTER TABLE public.notifications ADD COLUMN action_label TEXT;
    END IF;

    -- 5. action_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'action_url') THEN
        ALTER TABLE public.notifications ADD COLUMN action_url TEXT;
    END IF;

    -- 6. metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'metadata') THEN
        ALTER TABLE public.notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- 7. member_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'member_id') THEN
        ALTER TABLE public.notifications ADD COLUMN member_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;

    -- 8. payment_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'payment_id') THEN
        ALTER TABLE public.notifications ADD COLUMN payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL;
    END IF;

     -- 9. type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'type') THEN
        ALTER TABLE public.notifications ADD COLUMN type TEXT DEFAULT 'info';
    END IF;

    -- 10. is_read
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
        ALTER TABLE public.notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
    END IF;

    -- 11. read (Legacy)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read') THEN
        ALTER TABLE public.notifications ADD COLUMN read BOOLEAN DEFAULT FALSE;
    END IF;

END $$;

-- Reload Schema to be sure
NOTIFY pgrst, 'reload schema';
