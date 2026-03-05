-- ============================================================================
-- GYMZ: Member Registration Details (Extended Profile)
-- Date: 2026-04-12
-- Adds phone, profession, NRC/Passport, nationality, and terms consent
-- to support full registration form on AI Calibration screen.
-- ============================================================================

-- Add columns to public.users (phone may already exist from prior migrations)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profession TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nrc_or_passport TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS terms_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS terms_consent_date TIMESTAMPTZ;

COMMENT ON COLUMN public.users.profession IS 'Member profession or occupation';
COMMENT ON COLUMN public.users.nrc_or_passport IS 'National Registration Card (NRC) or Passport number for identity verification';
COMMENT ON COLUMN public.users.nationality IS 'Member nationality';
COMMENT ON COLUMN public.users.terms_consent IS 'User agreed to Terms and Conditions at registration';
COMMENT ON COLUMN public.users.terms_consent_date IS 'Timestamp when user accepted Terms and Conditions';

NOTIFY pgrst, 'reload schema';
