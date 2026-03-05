-- ============================================================================
-- FIX FACILITIES UPSERT CONSTRAINT
-- Date: 2026-02-27
-- Purpose: Add unique constraint to support UPSERT in onboarding wizard Step 5.
-- ============================================================================

-- First, cleanup any duplicates that might already exist to avoid migration failure
-- We keep only the first (earliest) record for each (gym_id, item_name)
DELETE FROM public.gym_facilities_equipment a
USING public.gym_facilities_equipment b
WHERE a.id > b.id
  AND a.gym_id = b.gym_id
  AND a.item_name = b.item_name;

-- Add the unique constraint
-- This allows UPSERT onConflict (gym_id, item_name)
-- We use a named constraint so we can drop/manage it later if needed
ALTER TABLE public.gym_facilities_equipment 
DROP CONSTRAINT IF EXISTS uq_gym_facilities_item_name;

ALTER TABLE public.gym_facilities_equipment 
ADD CONSTRAINT uq_gym_facilities_item_name UNIQUE (gym_id, item_name);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
