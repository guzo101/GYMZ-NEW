-- ============================================================================
-- FIX: Community Events not showing in app under gym details
-- Date: 2026-03-22
--
-- Root causes addressed:
-- 1. RLS: Only authenticated users could view events; anon (browsing before sign-in) got nothing
-- 2. events_enabled: Gyms with NULL or false had Community Events section hidden
-- ============================================================================

BEGIN;

-- ─── 1. Allow anon users to view active events (for gym discovery before sign-in) ─
DROP POLICY IF EXISTS "Anon can view active events" ON public.events;
CREATE POLICY "Anon can view active events"
ON public.events FOR SELECT
TO anon
USING (is_active = true);

-- ─── 2. Backfill events_enabled for gyms that have events ─────────────────────
-- Gyms with events should show the Community Events section; ensure flag is true
UPDATE public.gyms g
SET events_enabled = true
WHERE (g.events_enabled IS NULL OR g.events_enabled = false)
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.gym_id = g.id AND e.is_active = true
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
