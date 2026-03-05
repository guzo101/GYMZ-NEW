-- ============================================================================
-- GYMZ: Deleted accounts record + Admin notification on account deletion
-- Date: 2026-05-05
-- Purpose: When a user deletes their account, (1) record it for admin visibility,
--          (2) notify gym admins in GMS. No FK to users since user is deleted.
-- ============================================================================

BEGIN;

-- ─── 1. Create deleted_accounts table (audit record for admins) ─────────────
CREATE TABLE IF NOT EXISTS public.deleted_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,                    -- Original user id (no FK - user deleted)
    email TEXT,
    name TEXT,
    unique_id TEXT,                           -- Member ID (e.g. GYM-001)
    gym_id UUID REFERENCES public.gyms(id) ON DELETE SET NULL,
    access_mode TEXT,                        -- gym_access | event_access
    deleted_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'              -- Extra context if needed
);

CREATE INDEX IF NOT EXISTS idx_deleted_accounts_gym_id ON public.deleted_accounts(gym_id);
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_deleted_at ON public.deleted_accounts(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_deleted_accounts_user_id ON public.deleted_accounts(user_id);

COMMENT ON TABLE public.deleted_accounts IS 'Audit log of users who deleted their accounts. Admins can view in GMS.';

-- ─── 2. RLS for deleted_accounts ───────────────────────────────────────────
ALTER TABLE public.deleted_accounts ENABLE ROW LEVEL SECURITY;

-- Gym admins and staff read their gym's deleted accounts; platform admins read all
DROP POLICY IF EXISTS "Admins read deleted accounts" ON public.deleted_accounts;
CREATE POLICY "Admins read deleted accounts"
ON public.deleted_accounts FOR SELECT
USING (
    (gym_id IS NOT NULL AND (public.is_gym_admin(gym_id) OR public.user_belongs_to_gym(gym_id)))
    OR public.is_platform_admin()
);

-- Only the record_account_deletion RPC inserts (SECURITY DEFINER)

-- ─── 3. RPC: Record account deletion + notify admin ────────────────────────
-- Called by mobile app BEFORE actual data deletion. Runs as definer to bypass RLS.
CREATE OR REPLACE FUNCTION public.record_account_deletion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_gym_name TEXT;
  v_msg TEXT;
  v_gym_id UUID;
BEGIN
  -- Fetch current user data (must be called by authenticated user)
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, email, name, unique_id, gym_id, access_mode
    INTO v_user
    FROM public.users
    WHERE id = auth.uid();

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  v_gym_id := v_user.gym_id;
  v_gym_name := COALESCE((SELECT name FROM public.gyms WHERE id = v_user.gym_id), 'Unknown Gym');

  -- 1. Insert into deleted_accounts (audit record)
  INSERT INTO public.deleted_accounts (user_id, email, name, unique_id, gym_id, access_mode)
  VALUES (
    v_user.id,
    v_user.email,
    COALESCE(v_user.name, v_user.email, 'Unknown'),
    v_user.unique_id,
    v_user.gym_id,
    v_user.access_mode
  );

  -- 2. Notify admins (user_id=NULL, gym_id for RLS visibility)
  v_msg := COALESCE(v_user.name, split_part(v_user.email, '@', 1), 'A member')
    || ' deleted their account'
    || CASE WHEN v_user.unique_id IS NOT NULL THEN ' (ID: ' || v_user.unique_id || ')' ELSE '' END
    || '. Email: ' || COALESCE(v_user.email, '—');

  -- If user has gym_id, notify that gym's admins
  IF v_gym_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, gym_id, type, message, priority, is_read, status, action_url, action_label
    ) VALUES (
      NULL,
      v_gym_id,
      'account_deleted',
      v_msg,
      2,
      FALSE,
      'unread',
      '/admin/deleted-accounts',
      'View Deleted Accounts'
    );
  END IF;

  -- Also notify platform admins if we have a way (gym_id NULL with platform scope)
  -- Platform admins typically see notifications where gym_id matches their gym_contacts
  -- or is NULL. For now, gym-scoped notification above covers gym admins.
  -- Platform/super admins may need a separate notification - add if needed.

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute to authenticated users (they call it before deleting)
GRANT EXECUTE ON FUNCTION public.record_account_deletion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_account_deletion() TO service_role;

-- ─── 4. Add account_deleted to notification type handling (optional) ────────
-- Notifications table accepts any type string; no schema change needed.

COMMIT;

NOTIFY pgrst, 'reload schema';
