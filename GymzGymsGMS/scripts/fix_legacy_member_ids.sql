-- ============================================================================
-- FIX: Convert legacy EV-/EVT-/GY- member IDs to new format (SF-E60045 / SF-60045)
-- Run in Supabase SQL Editor.
--
-- IMPORTANT: Run apply_new_id_generator.sql FIRST to update the generator.
-- Then run this script.
-- ============================================================================

-- STEP 1 (optional): Pre-check — all should be true
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') AS users_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'membership') AS membership_exists,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'generate_gym_member_id') AS generate_fn_exists;

-- STEP 2: Copy everything from here down and run it in SQL Editor.
-- This creates a helper, then runs it. You'll see: updated_count | skipped_count
CREATE OR REPLACE FUNCTION public.fix_legacy_member_ids()
RETURNS TABLE(updated_count INTEGER, skipped_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_new_id TEXT;
  v_is_event BOOLEAN;
  v_gym_id UUID;
  v_updated INTEGER := 0;
  v_skipped INTEGER := 0;
BEGIN
  -- Disable trigger so it doesn't overwrite our changes
  ALTER TABLE public.users DISABLE TRIGGER trigger_ensure_member_unique_id;

  FOR r IN
    SELECT u.id, u.gym_id, u.unique_id, u.access_mode,
           (SELECT m.gym_id FROM public.membership m WHERE m.user_id = u.id LIMIT 1) AS m_gym_id
    FROM public.users u
    WHERE u.unique_id IS NOT NULL
      AND u.unique_id <> ''
      AND (u.unique_id LIKE 'EV-%' OR u.unique_id LIKE 'EVT-%' OR u.unique_id LIKE 'GY-%')
  LOOP
    v_gym_id := COALESCE(r.gym_id, r.m_gym_id);
    IF v_gym_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    v_is_event := (r.access_mode = 'event_access');
    v_new_id := public.generate_gym_member_id(v_gym_id, v_is_event);
    UPDATE public.users SET unique_id = v_new_id, gym_id = v_gym_id, updated_at = NOW() WHERE id = r.id;
    -- Sync membership table too
    UPDATE public.membership SET unique_member_id = v_new_id, updated_at = NOW() WHERE user_id = r.id AND gym_id = v_gym_id;
    v_updated := v_updated + 1;
  END LOOP;

  -- Re-enable trigger
  ALTER TABLE public.users ENABLE TRIGGER trigger_ensure_member_unique_id;

  RETURN QUERY SELECT v_updated, v_skipped;
END;
$$;

SELECT * FROM public.fix_legacy_member_ids();
