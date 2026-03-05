-- Migration: Enable RLS and create comprehensive policies for notice_board
-- This fixes the issue where users cannot view or send messages in community chat

-- Enable RLS on notice_board table
ALTER TABLE notice_board ENABLE ROW LEVEL SECURITY;

-- DROP existing policies if they exist (for idempotent migrations)
DROP POLICY IF EXISTS "Allow users to insert AI messages" ON notice_board;
DROP POLICY IF EXISTS "Allow authenticated users to view all messages" ON notice_board;
DROP POLICY IF EXISTS "Allow users to insert their own messages" ON notice_board;
DROP POLICY IF EXISTS "Allow users to update their own messages" ON notice_board;
DROP POLICY IF EXISTS "Allow users to delete their own messages" ON notice_board;

-- Policy 1: Allow all authenticated users to SELECT (view) messages
CREATE POLICY "Allow authenticated users to view all messages"
ON notice_board
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Allow users to INSERT their own messages
CREATE POLICY "Allow users to insert their own messages"
ON notice_board
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND sender_type IN ('user', 'admin')
);

-- Policy 3: Allow authenticated users to insert AI messages
-- This is needed because the AI response logic runs on the client side
CREATE POLICY "Allow users to insert AI messages"
ON notice_board
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'admin_assist'
);

-- Policy 4: Allow users to UPDATE their own messages
CREATE POLICY "Allow users to update their own messages"
ON notice_board
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 5: Allow users to DELETE their own messages
CREATE POLICY "Allow users to delete their own messages"
ON notice_board
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Documentation
COMMENT ON POLICY "Allow authenticated users to view all messages" ON notice_board IS 'Allows all authenticated users to view all messages in the community chat';
COMMENT ON POLICY "Allow users to insert their own messages" ON notice_board IS 'Allows authenticated users to insert messages as themselves';
COMMENT ON POLICY "Allow users to insert AI messages" ON notice_board IS 'Allows any authenticated user to insert a message if it is marked as being from the AI (admin_assist). Required for client-side AI generation.';
COMMENT ON POLICY "Allow users to update their own messages" ON notice_board IS 'Allows users to update only their own messages';
COMMENT ON POLICY "Allow users to delete their own messages" ON notice_board IS 'Allows users to delete only their own messages';

