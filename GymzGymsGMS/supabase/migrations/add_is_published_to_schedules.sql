-- Migration: Add is_published column to gym_class_schedules
-- This allows admins to create draft schedules and publish them to the calendar

-- Add is_published column (defaults to false for new schedules)
ALTER TABLE gym_class_schedules 
ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;

-- Create index for filtering published schedules
CREATE INDEX IF NOT EXISTS idx_gym_class_schedules_is_published 
ON gym_class_schedules(is_published);

-- Add comment for documentation
COMMENT ON COLUMN gym_class_schedules.is_published IS 'Whether the schedule is published to the gym calendar (visible to members)';
