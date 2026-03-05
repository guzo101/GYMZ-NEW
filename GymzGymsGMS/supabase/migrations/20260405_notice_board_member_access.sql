-- ============================================================================
-- FIX: Community Chat RLS - Allow members to post in notice_board
-- Date: 2026-04-05
--
-- Problem: 20260225_harden_gym_isolation replaced notice_board policies with
-- a single policy that only allows is_gym_admin(gym_id). This blocks ALL
-- regular members from inserting messages, causing "new row violates row-level
-- security policy for table 'notice_board'" when users try to chat.
--
-- Solution: Replace with policies that allow members to read/write within
-- their gym scope, and add a trigger to auto-set gym_id on insert.
-- ============================================================================

BEGIN;

-- ─── 1. Trigger: Auto-set gym_id on INSERT when NULL ───────────────────────
-- The app does not send gym_id; we derive it from the posting user's gym.
CREATE OR REPLACE FUNCTION public.notice_board_set_gym_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.gym_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT gym_id INTO NEW.gym_id
    FROM public.users
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notice_board_set_gym_id ON public.notice_board;
CREATE TRIGGER trg_notice_board_set_gym_id
  BEFORE INSERT ON public.notice_board
  FOR EACH ROW
  EXECUTE FUNCTION public.notice_board_set_gym_id();

-- ─── 2. Drop the restrictive admin-only policy ─────────────────────────────
DROP POLICY IF EXISTS "table_notice_board_gym_isolation" ON public.notice_board;

-- ─── 3. SELECT: Members see messages from their gym (or legacy NULL gym_id) ─
CREATE POLICY "notice_board_select_member_gym"
ON public.notice_board FOR SELECT
TO authenticated
USING (
  gym_id IS NULL
  OR gym_id = (SELECT gym_id FROM public.users WHERE id = auth.uid())
  OR public.is_gym_admin(gym_id)
);

-- ─── 4. INSERT: Members can post as themselves; AI/admin_assist for webhook ─
CREATE POLICY "notice_board_insert_own"
ON public.notice_board FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id AND sender_type IN ('user', 'admin'))
  OR (sender_type IN ('admin_assist', 'ai'))
);

-- ─── 5. UPDATE: Users can update only their own messages ─────────────────────
CREATE POLICY "notice_board_update_own"
ON public.notice_board FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ─── 6. DELETE: Users delete own; admins can delete in their gym ────────────
CREATE POLICY "notice_board_delete_own_or_admin"
ON public.notice_board FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_gym_admin(gym_id)
);

COMMIT;

NOTIFY pgrst, 'reload schema';
