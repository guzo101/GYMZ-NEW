-- ============================================================================
-- GYMZ: MINIMAL SIGNUP FIX — DML ONLY (No function definitions)
-- Purpose: Ensure the gym records the trigger needs actually exist.
-- The existing trigger in production uses gym_id 'a1b2...' as fallback.
-- Until we replace the trigger cleanly, that gym_id must exist.
-- ============================================================================

-- Step 1: Ensure The Sweat Factory (canonical gym) exists
INSERT INTO public.gyms (id, name, short_code, slug, status, subscription_plan, events_enabled, sponsors_enabled)
VALUES (
    '66874288-028a-495b-b98a-ceddf94876b6',
    'The Sweat Factory',
    'SF',
    'the-sweat-factory',
    'active',
    'pro',
    true,
    true
)
ON CONFLICT (id) DO UPDATE SET
    status = 'active',
    short_code = COALESCE(public.gyms.short_code, 'SF');

-- Step 2: Ensure the placeholder gym the current trigger expects also exists
INSERT INTO public.gyms (id, name, short_code, slug, status, subscription_plan)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Gymz Default (Legacy Fallback)',
    'GZ',
    'gymz-default-legacy',
    'active',
    'basic'
)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Seed the sequence table so generate_gym_member_id() doesn't fail
INSERT INTO public.gym_id_sequences (gym_id, last_sequence_number)
VALUES ('66874288-028a-495b-b98a-ceddf94876b6', 0)
ON CONFLICT (gym_id) DO NOTHING;

INSERT INTO public.gym_id_sequences (gym_id, last_sequence_number)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 0)
ON CONFLICT (gym_id) DO NOTHING;

-- Step 4: Re-link any users still pointing at the placeholder to the canonical gym
UPDATE public.users
SET gym_id = '66874288-028a-495b-b98a-ceddf94876b6'
WHERE gym_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
