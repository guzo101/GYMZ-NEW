-- Migration: Create conversations table for AI chat
-- This table stores all messages in conversations between users, admins, and AI

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'admin', 'ai')),
  message TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_thread_id ON conversations(thread_id);
CREATE INDEX IF NOT EXISTS idx_conversations_chat_id ON conversations(chat_id);
CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_chat ON conversations(user_id, chat_id);

-- Add comment for documentation
COMMENT ON TABLE conversations IS 'Stores all AI chat messages. thread_id is permanent per user, chat_id changes per session.';
COMMENT ON COLUMN conversations.thread_id IS 'Permanent thread identifier for long-term AI context. One per user.';
COMMENT ON COLUMN conversations.chat_id IS 'Session identifier that changes when starting new chat or after 24h inactivity.';
COMMENT ON COLUMN conversations.sender IS 'Message sender: user, admin, or ai';





