-- ============================================================================
-- GYMZ: FIX GYM ID ASSIGNMENT & UNIQUE ID GENERATION
-- Date: 2026-02-26
-- Purpose: Ensures users get a professional member ID the moment they are assigned a gym.
-- ============================================================================

BEGIN;

-- 1. Create a function to handle the trigger
CREATE OR REPLACE FUNCTION public.ensure_member_unique_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate if:
    -- 1. A gym_id is being assigned (was null, now has a value)
    -- 2. OR gym_id is changing (not likely to happen often but possible)
    -- 3. AND unique_id is currently NULL or empty
    
    IF NEW.gym_id IS NOT NULL AND (OLD.gym_id IS NULL OR NEW.gym_id <> OLD.gym_id) THEN
        IF NEW.unique_id IS NULL OR NEW.unique_id = '' THEN
            BEGIN
                NEW.unique_id := public.generate_gym_member_id(NEW.gym_id);
            EXCEPTION WHEN OTHERS THEN
                -- If the generator fails, don't block the user update, just log or let it be null
                RAISE WARNING 'Failed to generate unique_id for user %: %', NEW.id, SQLERRM;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to the users table
DROP TRIGGER IF EXISTS trigger_ensure_member_unique_id ON public.users;
CREATE TRIGGER trigger_ensure_member_unique_id
BEFORE UPDATE OF gym_id ON public.users
FOR EACH ROW
WHEN (NEW.gym_id IS NOT NULL AND (OLD.gym_id IS NULL OR NEW.unique_id IS NULL))
EXECUTE FUNCTION public.ensure_member_unique_id();

-- 3. Backfill existing users who belong to a gym but have no unique_id
UPDATE public.users 
SET unique_id = public.generate_gym_member_id(gym_id)
WHERE gym_id IS NOT NULL 
  AND (unique_id IS NULL OR unique_id = '');

COMMIT;

-- Reload Supabase schema cache
NOTIFY pgrst, 'reload schema';
