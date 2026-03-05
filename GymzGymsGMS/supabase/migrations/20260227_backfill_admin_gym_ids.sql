-- ============================================================================
-- GYMZ: Backfill gym_id for admin/staff users who have NULL gym_id
-- One-time migration to fix all existing affected admins
-- ============================================================================

-- Resolve gym_id from gym_contacts for any admin/staff with missing gym_id
UPDATE public.users u
SET gym_id = gc.gym_id,
    updated_at = NOW()
FROM public.gym_contacts gc
WHERE u.email = gc.email
  AND gc.is_active = true
  AND u.gym_id IS NULL
  AND u.role IN ('admin', 'staff');
