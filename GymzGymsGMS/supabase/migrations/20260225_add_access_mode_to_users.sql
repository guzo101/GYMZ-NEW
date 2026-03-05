-- ============================================================================
-- ADD ACCESS MODE AND CRM TAG TO USERS TABLE
-- Supports distinct onboarding pathways: Gym Nutrition vs Event Access
-- ============================================================================

DO $$ 
BEGIN
  -- 1. Add access_mode column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'access_mode'
  ) THEN
    ALTER TABLE public.users ADD COLUMN access_mode TEXT DEFAULT 'gym_access';
    RAISE NOTICE 'Added access_mode column to users table';
  END IF;

  -- 2. Add crm_tag column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'crm_tag'
  ) THEN
    ALTER TABLE public.users ADD COLUMN crm_tag TEXT;
    RAISE NOTICE 'Added crm_tag column to users table';
  END IF;

END $$;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
