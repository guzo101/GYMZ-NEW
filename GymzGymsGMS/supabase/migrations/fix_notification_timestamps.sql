-- Migration: Fix notification timestamps
-- Ensures created_at and updated_at have proper defaults and fix NULL values

-- Ensure created_at has proper default (NOW() in UTC)
ALTER TABLE notifications 
ALTER COLUMN created_at SET DEFAULT NOW();

-- Ensure updated_at has proper default  
ALTER TABLE notifications 
ALTER COLUMN updated_at SET DEFAULT NOW();

-- Update NULL created_at values to NOW() (current timestamp)
UPDATE notifications 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- Update NULL updated_at values
UPDATE notifications 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Add comment explaining timezone usage
COMMENT ON COLUMN notifications.created_at IS 'Timestamp in UTC - convert to local timezone in application';
COMMENT ON COLUMN notifications.updated_at IS 'Timestamp in UTC - convert to local timezone in application';
