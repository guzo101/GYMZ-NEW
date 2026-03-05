-- Ensure preferred_workout_time column is in users table
-- This migration is idempotent and safe to run multiple times.
-- Run this if you see: "Could not find the 'preferred_workout_time' column of 'users' in the schema cache"

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferred_workout_time TIME;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
