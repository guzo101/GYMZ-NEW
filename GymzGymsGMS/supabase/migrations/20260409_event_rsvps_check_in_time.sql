-- Migration: Add check_in_time column to event_rsvps
-- Required for event check-in (PGRST204 schema cache error)
-- Date: 2026-04-09

ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ;

COMMENT ON COLUMN public.event_rsvps.check_in_time IS 'When the member checked in at the event venue';

NOTIFY pgrst, 'reload schema';
