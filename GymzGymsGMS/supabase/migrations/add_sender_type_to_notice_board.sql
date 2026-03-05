-- Migration: Add sender_type column to notice_board table
-- This allows distinguishing between user, admin, ai, and admin_assist messages

-- Add sender_type column if it doesn't exist
ALTER TABLE notice_board 
ADD COLUMN IF NOT EXISTS sender_type TEXT DEFAULT 'user' CHECK (sender_type IN ('user', 'admin', 'ai', 'admin_assist'));

-- Update existing rows to have default sender_type based on user role
-- This is a one-time update for existing data
UPDATE notice_board 
SET sender_type = CASE 
  WHEN EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = notice_board.user_id 
    AND users.role = 'admin'
  ) THEN 'admin'
  ELSE 'user'
END
WHERE sender_type IS NULL OR sender_type = 'user';

-- Create index for efficient filtering by sender_type
CREATE INDEX IF NOT EXISTS idx_notice_board_sender_type ON notice_board(sender_type);

-- Add comment
COMMENT ON COLUMN notice_board.sender_type IS 'Type of sender: user, admin, ai, or admin_assist. admin_assist is for AI assistant messages.';





