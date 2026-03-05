-- Migration: Add Preferred Workout Timing Columns
-- Add columns to the users table to support the Circadian Nudge strategy

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferred_workout_time TIME,
ADD COLUMN IF NOT EXISTS auto_timing_enabled BOOLEAN DEFAULT TRUE;

-- Add a comment for documentation
COMMENT ON COLUMN users.preferred_workout_time IS 'The user''s manually set or AI-suggested preferred time for working out.';
COMMENT ON COLUMN users.auto_timing_enabled IS 'Whether to automatically calculate preferred time based on attendance history.';
