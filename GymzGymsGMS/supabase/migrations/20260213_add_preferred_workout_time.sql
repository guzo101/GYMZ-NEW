-- Add missing preferred_workout_time column
-- This column is referenced by the Edit Profile screen but doesn't exist in the schema

BEGIN;

-- Add the column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS preferred_workout_time TIME;

COMMIT;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
