-- ============================================================================
-- GYMZ: PROFESSIONAL ID BACKFILL (Absolute Harmony)
-- Date: 2026-02-24
-- Purpose: Generate professional member IDs for users missing them.
-- ============================================================================

BEGIN;

-- 1. Ensure the sequence table is seeded for the canonical gym
INSERT INTO public.gym_id_sequences (gym_id, last_sequence_number)
VALUES ('66874288-028a-495b-b98a-ceddf94876b6', 0)
ON CONFLICT (gym_id) DO NOTHING;

-- 2. Backfill missing unique_ids using the generator
-- Only for users who have a gym_id and are missing a unique_id
UPDATE public.users 
SET unique_id = public.generate_gym_member_id(gym_id) 
WHERE (unique_id IS NULL OR unique_id = '') 
AND gym_id IS NOT NULL;

-- 3. Audit check
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.users WHERE (unique_id IS NULL OR unique_id = '');
    IF v_count > 0 THEN
        RAISE NOTICE 'Found % users still missing unique_id (likely missing gym_id).', v_count;
    ELSE
        RAISE NOTICE 'All users now have unique_ids.';
    END IF;
END $$;

COMMIT;

-- Reload Supabase schema cache
NOTIFY pgrst, 'reload schema';
