-- Migration: Add password field to gym_applications
-- This is used to capture the initial admin password during onboarding.

ALTER TABLE public.gym_applications
ADD COLUMN IF NOT EXISTS password TEXT;

COMMENT ON COLUMN public.gym_applications.password IS 'Temporary storage for owner password until provisioning.';
