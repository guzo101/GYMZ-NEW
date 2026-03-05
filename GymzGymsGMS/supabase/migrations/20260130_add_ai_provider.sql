-- Migration: Add AI Provider Toggle
-- Allows switching between Make.com and Direct OpenAI

ALTER TABLE ai_settings 
ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(50) DEFAULT 'make';

-- Comments
COMMENT ON COLUMN ai_settings.ai_provider IS 'The AI provider to use: ''make'' or ''openai''';

-- Update existing active settings to use 'make' by default
UPDATE ai_settings SET ai_provider = 'make' WHERE is_active = true AND ai_provider IS NULL;
