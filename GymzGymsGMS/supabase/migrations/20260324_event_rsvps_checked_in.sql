-- ============================================================================
-- Add checked_in column to event_rsvps for RSVP Management / check-in
-- Date: 2026-03-24
-- GMS RSVP Management and QR check-in require this column
-- ============================================================================

ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.event_rsvps.checked_in IS 'True when member has checked in at the event venue';

NOTIFY pgrst, 'reload schema';
