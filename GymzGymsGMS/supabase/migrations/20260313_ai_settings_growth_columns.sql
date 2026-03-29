-- Add growth_auto_pilot and growth_frequency_days to ai_settings (used by AISettings UI)
-- Fixes: "Could not find the 'growth_auto_pilot' column of 'ai_settings' in the schema cache"

ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS growth_auto_pilot BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS growth_frequency_days INTEGER DEFAULT 7;

COMMENT ON COLUMN public.ai_settings.growth_auto_pilot IS 'Whether growth/outreach auto-pilot is enabled';
COMMENT ON COLUMN public.ai_settings.growth_frequency_days IS 'Frequency in days for growth automation';
