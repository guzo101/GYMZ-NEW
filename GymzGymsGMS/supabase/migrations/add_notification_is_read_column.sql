-- Migration: Add is_read column to notifications table
-- This column tracks whether a notification has been read by the admin

-- Add is_read column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create index on is_read for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Update existing notifications to be unread by default
UPDATE notifications SET is_read = false WHERE is_read IS NULL;

