-- Migration: Create notice_board table for community chat/notice board
-- This table stores all posts shared by members and admins in the community

CREATE TABLE IF NOT EXISTS notice_board (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notice_board_user_id ON notice_board(user_id);
CREATE INDEX IF NOT EXISTS idx_notice_board_created_at ON notice_board(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_notice_board_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notice_board_updated_at
  BEFORE UPDATE ON notice_board
  FOR EACH ROW
  EXECUTE FUNCTION update_notice_board_updated_at();

-- Add comment for documentation
COMMENT ON TABLE notice_board IS 'Community notice board where all members and admins can share posts and interact';
COMMENT ON COLUMN notice_board.user_id IS 'The user who created the post';
COMMENT ON COLUMN notice_board.content IS 'The content of the post';

-- Note: RLS is disabled for this table as the application uses custom authentication
-- Application-level security is enforced in the NoticeBoard component
-- All authenticated users (members and admins) can read, create, update, and delete posts
-- The component enforces that users can only edit/delete their own posts (unless admin)

