-- ============================================================================
-- GYMZ: delete_my_account() RPC - Server-side user record deletion
-- Date: 2026-05-06
-- Purpose: Enables users to delete their own record. Runs as SECURITY DEFINER
--          to bypass RLS (which often blocks self-delete). Records deletion,
--          notifies admins, then deletes all user data.
-- ============================================================================

BEGIN;

-- Tables to delete from (child tables first, users last). Use user_id column.
-- Order matters for FK constraints.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user RECORD;
  v_gym_id UUID;
  v_msg TEXT;
  v_tbl TEXT;
  v_tables TEXT[] := ARRAY[
    'user_device_tokens', 'push_tokens', 'notice_board_reactions', 'user_ai_memory',
    'user_badge_progress', 'user_streaks', 'user_fitness_goals', 'daily_nutrition_logs',
    'water_logs', 'body_metrics', 'user_snapshots', 'exercise_progress',
    'weekly_progress_summary', 'conversations', 'ai_messages', 'subscriptions',
    'payments', 'attendance', 'workout_sessions', 'event_rsvps', 'room_members',
    'limited_access_logs', 'xp_transactions', 'daily_calorie_summary', 'membership'
  ];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Fetch user data before deletion
  SELECT id, email, name, unique_id, gym_id, access_mode
    INTO v_user
    FROM public.users
    WHERE id = v_uid;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  v_gym_id := v_user.gym_id;

  -- 1. Record deletion + notify admins (same logic as record_account_deletion)
  INSERT INTO public.deleted_accounts (user_id, email, name, unique_id, gym_id, access_mode)
  VALUES (
    v_user.id,
    v_user.email,
    COALESCE(v_user.name, v_user.email, 'Unknown'),
    v_user.unique_id,
    v_user.gym_id,
    v_user.access_mode
  );

  v_msg := COALESCE(v_user.name, split_part(v_user.email, '@', 1), 'A member')
    || ' deleted their account'
    || CASE WHEN v_user.unique_id IS NOT NULL THEN ' (ID: ' || v_user.unique_id || ')' ELSE '' END
    || '. Email: ' || COALESCE(v_user.email, '—');

  IF v_gym_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, gym_id, type, message, priority, is_read, status, action_url, action_label
    ) VALUES (
      NULL, v_gym_id, 'account_deleted', v_msg, 2, FALSE, 'unread',
      '/admin/deleted-accounts', 'View Deleted Accounts'
    );
  END IF;

  -- 2. Delete from user_data tables (skip if table/column doesn't exist)
  FOREACH v_tbl IN ARRAY v_tables
  LOOP
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', v_tbl) USING v_uid;
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_column THEN NULL;
      WHEN OTHERS THEN NULL; -- Log and continue
    END;
  END LOOP;

  -- 3. Delete users row
  DELETE FROM public.users WHERE id = v_uid;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
