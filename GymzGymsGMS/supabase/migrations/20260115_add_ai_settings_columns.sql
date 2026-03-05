-- Migration: Add missing columns to ai_settings table
-- This adds scanner_model, auto_reply_enabled, and openai_api_key columns
-- Created: 2026-01-15

ALTER TABLE ai_settings 
ADD COLUMN IF NOT EXISTS scanner_model TEXT DEFAULT 'gpt-4o',
ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS openai_api_key TEXT;

-- Add comments for documentation
COMMENT ON COLUMN ai_settings.scanner_model IS 'The AI model used for food scanning (e.g., gpt-4o, gpt-4o-mini)';
COMMENT ON COLUMN ai_settings.auto_reply_enabled IS 'Whether AI auto-reply is enabled for the community chat';
COMMENT ON COLUMN ai_settings.openai_api_key IS 'OpenAI API key used for visionary food scanning';
