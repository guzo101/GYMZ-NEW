-- ============================================================================
-- Add gym-specific per-plan inclusions from onboarding
-- ============================================================================

ALTER TABLE public.gym_membership_plans
    ADD COLUMN IF NOT EXISTS custom_inclusions TEXT[] DEFAULT '{}'::TEXT[];

UPDATE public.gym_membership_plans
SET custom_inclusions = '{}'::TEXT[]
WHERE custom_inclusions IS NULL;
