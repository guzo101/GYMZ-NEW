-- =====================================================
-- FIX: MISSING weight_lost COLUMN IN users TABLE
-- Date: 2026-02-26
-- =====================================================

BEGIN;

-- Add weight_lost column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS weight_lost NUMERIC DEFAULT 0;

-- Comment for documentation
COMMENT ON COLUMN public.users.weight_lost IS 'Total weight lost by the user in kg';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
