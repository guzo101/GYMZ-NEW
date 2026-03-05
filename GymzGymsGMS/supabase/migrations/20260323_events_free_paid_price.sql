-- ============================================================================
-- Add free/paid and price columns to events
-- Date: 2026-03-23
-- Admins can mark events as free or paid; paid events show price in app
-- ============================================================================

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) DEFAULT NULL;

-- Existing events default to free
UPDATE public.events SET is_free = true WHERE is_free IS NULL;
UPDATE public.events SET price = NULL WHERE is_free = true;

COMMENT ON COLUMN public.events.is_free IS 'When true, event is free; when false, price applies';
COMMENT ON COLUMN public.events.price IS 'Price in local currency (e.g. Kwacha) when is_free is false';

NOTIFY pgrst, 'reload schema';
