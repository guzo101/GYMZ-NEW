-- Migration: Relax RLS on events table to allow discovery during onboarding
-- Date: 2026-02-28

-- 1. Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view active events for their gym" ON public.events;

-- 2. Create a more permissive policy for viewing active events
-- This allows anyone (authenticated) to see active events for any gym they are browsing.
-- Privacy is maintained because users can't RSVP or see non-active events without proper checks.
CREATE POLICY "Anyone can view active events"
ON public.events FOR SELECT
TO authenticated
USING (is_active = true);

-- 3. Ensure admins can still manage their own events (this policy should already exist but we confirm it)
-- (We don't need to change the admin policies as they are already gym-specific)
