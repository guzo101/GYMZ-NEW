-- ============================================================================
-- GYMZ ABSOLUTE HARMONY: FINAL STEWARDSHIP & DRIFT ELIMINATION
-- Date: 2026-03-02
-- Purpose: 
-- 1. Correct height unit drift (M to CM).
-- 2. Normalize status casing for UI alignment.
-- 3. Backfill missing professional Member IDs.
-- 4. Force synchronization of App vs GMS goal fields.
-- ============================================================================

BEGIN;

-- ─── 1. BIOMETRIC ALIGNMENT (THE CENTIMETER GUARD) ──────────────────────────
-- Converts any legacy height values from meters (e.g., 1.75) to centimeters (175.0).
-- This ensures all AI, BMI, and TDEE math is consistent across the ecosystem.
UPDATE public.users 
SET height = height * 100 
WHERE height > 0 AND height < 3;

-- ─── 2. CASE NORMALIZATION (STATUS ALIGNMENT) ──────────────────────────────
-- Forces all membership and payment statuses to lowercase.
-- This prevents "Active" vs "active" filtering bugs in the UI.
UPDATE public.users 
SET membership_status = LOWER(membership_status) 
WHERE membership_status IS NOT NULL;

UPDATE public.payments 
SET status = LOWER(status) 
WHERE status IS NOT NULL;

UPDATE public.payments 
SET payment_status = LOWER(payment_status) 
WHERE payment_status IS NOT NULL;

-- ─── 3. PROFESSIONAL ID BACKFILL ───────────────────────────────────────────
-- Ensures every member has a professional ID (e.g., SG260001) using the per-gym sequence.
UPDATE public.users 
SET unique_id = public.generate_gym_member_id(gym_id) 
WHERE (unique_id IS NULL OR unique_id = '') 
AND gym_id IS NOT NULL;

-- ─── 4. GOAL BRIDGE VERIFICATION ───────────────────────────────────────────
-- Synchronizes 'goal' (Nutrition App) and 'primary_objective' (GMS) for existing data.
UPDATE public.users 
SET goal = COALESCE(goal, primary_objective),
    primary_objective = COALESCE(primary_objective, goal)
WHERE goal IS DISTINCT FROM primary_objective;

COMMIT;

-- Reload Supabase schema cache
NOTIFY pgrst, 'reload schema';
