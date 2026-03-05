-- Migration: Fix AI message insertion policy
-- This fixes the RLS policy violation when AI tries to insert messages into notice_board
-- The issue was that the policy required auth.uid() to match user_id, but AI insertions
-- happen after webhook response, potentially without user authentication context

-- Drop the old policy that was too restrictive
DROP POLICY IF EXISTS "Allow users to insert AI messages" ON notice_board;

-- Create a new, more permissive policy for AI message insertions
-- This allows any authenticated user to insert a message as admin_assist
-- as long as it's marked with sender_type = 'admin_assist'
CREATE POLICY "Allow users to insert AI messages"
ON notice_board
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'admin_assist' OR sender_type = 'ai'
);

-- Documentation
COMMENT ON POLICY "Allow users to insert AI messages" ON notice_board IS 
'Allows any authenticated user to insert AI assistant messages. This is required because AI responses are generated via webhook and inserted on behalf of users.';
