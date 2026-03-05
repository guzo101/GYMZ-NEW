-- ============================================================================
-- GYMZ PLATFORM: FINAL PRECISION FIX (Jane & Legacy Users)
-- Purpose: Re-link users from placeholder gym ID to the REAL Sweat Factory ID.
-- ============================================================================

DO $FIX$
DECLARE
    v_real_gym_id UUID := '66874288-028a-495b-b98a-ceddf94876b6'; -- Real ID for The Sweat Factory
    v_placeholder_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN
    -- 1. FIX GYM ASSOCIATION FOR EVERYONE ON THE PLACEHOLDER
    UPDATE public.users 
    SET gym_id = v_real_gym_id 
    WHERE gym_id = v_placeholder_id;

    -- 2. ENSURE JANE SPECIFICALLY IS LINKED & ACTIVE
    UPDATE public.users
    SET 
        gym_id = v_real_gym_id,
        membership_status = 'Active',
        status = 'Active',
        -- Force-re-sync metrics just in case of any weirdness
        height = COALESCE(height, (NULLIF(metadata->>'height', ''))::NUMERIC),
        weight = COALESCE(weight, (NULLIF(metadata->>'weight', ''))::NUMERIC),
        age = COALESCE(age, (NULLIF(metadata->>'age', ''))::INTEGER)
    WHERE email = 'jane@msafiristudios.com';

    -- 3. FIX ORPHANED PAYMENTS & SUBSCRIPTIONS
    -- Now that the users have the correct gym_id, their payment triggers should work,
    -- but we ensure their membership status is Active if they have successful payments.
    UPDATE public.users u
    SET membership_status = 'Active'
    WHERE gym_id = v_real_gym_id
      AND EXISTS (
          SELECT 1 FROM public.payments p 
          WHERE p.user_id = u.id AND p.status = 'completed'
      );

END $FIX$;

-- REFRESH
NOTIFY pgrst, 'reload schema';
