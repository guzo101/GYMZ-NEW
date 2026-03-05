-- ============================================================================
-- ADD MISSING COLUMNS TO GYMS TABLE
-- Adds columns referenced in OAC manual onboarding that may be missing
-- ============================================================================

ALTER TABLE public.gyms 
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'pro',
ADD COLUMN IF NOT EXISTS events_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sponsors_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS city TEXT;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
