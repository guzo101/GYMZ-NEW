-- Migration: Create ai_settings table for AI webhook configuration
-- This table stores the Make.ai webhook URL and settings

CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint to ensure only one active setting
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_settings_active ON ai_settings(is_active) WHERE is_active = TRUE;

-- Add comment for documentation
COMMENT ON TABLE ai_settings IS 'Stores AI integration settings, primarily the Make.ai webhook URL. Only one active setting allowed.';
COMMENT ON COLUMN ai_settings.webhook_url IS 'Make.ai webhook URL for sending messages and receiving AI responses';
COMMENT ON COLUMN ai_settings.is_active IS 'Only one setting can be active at a time';





