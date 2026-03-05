-- ============================================================================
-- Scope gym plans by access path (gym_access / event_access / both)
-- ============================================================================

ALTER TABLE public.gym_membership_plans
    ADD COLUMN IF NOT EXISTS access_mode_scope TEXT NOT NULL DEFAULT 'gym_access'
    CHECK (access_mode_scope IN ('gym_access', 'event_access', 'both'));

UPDATE public.gym_membership_plans
SET access_mode_scope = 'gym_access'
WHERE access_mode_scope IS NULL;
