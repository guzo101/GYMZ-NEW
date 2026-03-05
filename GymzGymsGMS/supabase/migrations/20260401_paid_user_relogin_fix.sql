-- ============================================================================
-- GYMZ: FIX — Paid users forced to payment flow after relogin
-- Date: 2026-04-01
-- Purpose:
--   1. Extend get_membership_for_gate to fallback to any active membership when
--      exact (user_id, gym_id, access_mode) match fails (handles multi-gym, stale context).
--   2. Add RPC to sync user's gym context when membership found for different gym.
--   3. Add guard to block new payment when user already has active membership for same entitlement.
--   4. Create entitlements RPC for explicit access flags (has_active_gym_membership, etc.).
-- ============================================================================

BEGIN;

-- ─── 1. EXTEND get_membership_for_gate: fallback to any active membership ───
-- When exact match fails (e.g. users.gym_id stale, multi-gym), return user's active membership.
-- Caller can use returned gym_id to sync context and route correctly.
CREATE OR REPLACE FUNCTION public.get_membership_for_gate(
  p_user_id UUID,
  p_gym_id UUID,
  p_access_mode TEXT
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  gym_id UUID,
  access_mode TEXT,
  membership_status public.membership_status_enum,
  approved BOOLEAN,
  approved_at TIMESTAMPTZ,
  unique_member_id TEXT,
  paid_at TIMESTAMPTZ,
  calibration_required BOOLEAN,
  calibration_completed BOOLEAN,
  calibration_completed_at TIMESTAMPTZ,
  gym_context_mismatch BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_mismatch BOOLEAN := false;
BEGIN
  -- 1. Exact match first
  SELECT m.id, m.user_id, m.gym_id, m.access_mode, m.membership_status, m.approved,
         m.approved_at, m.unique_member_id, m.paid_at, m.calibration_required,
         m.calibration_completed, m.calibration_completed_at
  INTO v_row
  FROM public.membership m
  WHERE m.user_id = p_user_id
    AND m.gym_id = p_gym_id
    AND m.access_mode = p_access_mode
  LIMIT 1;

  IF FOUND THEN
    gym_context_mismatch := false;
    RETURN QUERY SELECT
      v_row.id, v_row.user_id, v_row.gym_id, v_row.access_mode, v_row.membership_status,
      v_row.approved, v_row.approved_at, v_row.unique_member_id, v_row.paid_at,
      v_row.calibration_required, v_row.calibration_completed, v_row.calibration_completed_at,
      gym_context_mismatch;
    RETURN;
  END IF;

  -- 2. Fallback: any active membership for this user (handles multi-gym, stale gym_id)
  SELECT m.id, m.user_id, m.gym_id, m.access_mode, m.membership_status, m.approved,
         m.approved_at, m.unique_member_id, m.paid_at, m.calibration_required,
         m.calibration_completed, m.calibration_completed_at
  INTO v_row
  FROM public.membership m
  WHERE m.user_id = p_user_id
    AND m.membership_status = 'active'
    AND m.approved = true
  ORDER BY m.approved_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    gym_context_mismatch := true;  -- user's gym_id/access_mode didn't match; sync needed
    RETURN QUERY SELECT
      v_row.id, v_row.user_id, v_row.gym_id, v_row.access_mode, v_row.membership_status,
      v_row.approved, v_row.approved_at, v_row.unique_member_id, v_row.paid_at,
      v_row.calibration_required, v_row.calibration_completed, v_row.calibration_completed_at,
      gym_context_mismatch;
  END IF;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_membership_for_gate IS 'Returns membership for access gate. Falls back to any active membership when exact match fails (multi-gym, stale context). gym_context_mismatch=true means caller should sync users.gym_id/access_mode.';

-- ─── 2. RPC: Sync user gym context from membership (called when gym_context_mismatch) ─
CREATE OR REPLACE FUNCTION public.sync_user_gym_context_from_membership(
  p_user_id UUID,
  p_gym_id UUID,
  p_access_mode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  UPDATE public.users
  SET gym_id = p_gym_id, access_mode = p_access_mode, updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── 3. GUARD: Block payment insert when user already has active membership ─
-- Prevents double payment for same entitlement.
CREATE OR REPLACE FUNCTION public.guard_payment_against_active_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gym_id UUID;
  v_access_mode TEXT;
  v_user_id UUID;
  v_has_active INT;
BEGIN
  v_user_id := COALESCE(NEW.user_id, NEW.member_id);
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  v_gym_id := NEW.gym_id;
  IF v_gym_id IS NULL THEN
    SELECT u.gym_id, COALESCE(u.access_mode, 'gym_access') INTO v_gym_id, v_access_mode
    FROM public.users u WHERE u.id = v_user_id;
  ELSE
    SELECT COALESCE(u.access_mode, 'gym_access') INTO v_access_mode
    FROM public.users u WHERE u.id = v_user_id;
  END IF;

  IF v_gym_id IS NULL THEN RETURN NEW; END IF;
  v_access_mode := COALESCE(v_access_mode, 'gym_access');

  -- Only block for pending/new payments (not status updates)
  IF TG_OP = 'INSERT' AND LOWER(TRIM(COALESCE(NEW.status, ''))) IN ('pending', 'new', '') THEN
    SELECT COUNT(*) INTO v_has_active
    FROM public.membership m
    WHERE m.user_id = v_user_id
      AND m.gym_id = v_gym_id
      AND m.access_mode = v_access_mode
      AND m.membership_status = 'active'
      AND m.approved = true;

    IF v_has_active > 0 THEN
      RAISE EXCEPTION 'PAYMENT_BLOCKED: User already has active membership for this gym and access mode. Cannot create duplicate payment.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_payment_against_active_membership ON public.payments;
CREATE TRIGGER trg_guard_payment_against_active_membership
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_payment_against_active_membership();

-- ─── 4. RPC: get_entitlements_for_gate (explicit flags for routing) ─
CREATE OR REPLACE FUNCTION public.get_entitlements_for_gate(
  p_user_id UUID,
  p_gym_id UUID,
  p_access_mode TEXT
)
RETURNS TABLE (
  has_active_gym_membership BOOLEAN,
  has_event_access BOOLEAN,
  membership_type TEXT,
  expires_at TIMESTAMPTZ,
  gym_member_id TEXT,
  gym_id UUID,
  access_mode TEXT,
  calibration_completed BOOLEAN,
  gym_context_mismatch BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m RECORD;
BEGIN
  SELECT * INTO v_m FROM public.get_membership_for_gate(p_user_id, p_gym_id, p_access_mode) LIMIT 1;

  IF NOT FOUND THEN
    has_active_gym_membership := false;
    has_event_access := false;
    membership_type := NULL;
    expires_at := NULL;
    gym_member_id := NULL;
    gym_id := NULL;
    access_mode := NULL;
    calibration_completed := false;
    gym_context_mismatch := false;
    RETURN NEXT;
    RETURN;
  END IF;

  has_active_gym_membership := (v_m.membership_status = 'active' AND v_m.approved = true AND v_m.access_mode = 'gym_access');
  has_event_access := (v_m.membership_status = 'active' AND v_m.approved = true AND v_m.access_mode = 'event_access');
  membership_type := v_m.membership_status::TEXT;
  expires_at := NULL;  -- Could be extended from subscriptions if needed
  gym_member_id := v_m.unique_member_id;
  gym_id := v_m.gym_id;
  access_mode := v_m.access_mode;
  calibration_completed := v_m.calibration_completed;
  gym_context_mismatch := COALESCE(v_m.gym_context_mismatch, false);
  RETURN NEXT;
END;
$$;

-- ─── 5. BACKFILL: Event_access users with unique_id but no membership ─
INSERT INTO public.membership (
  user_id, gym_id, access_mode,
  membership_status, approved, approved_at, unique_member_id,
  calibration_required, calibration_completed, updated_at
)
SELECT
  u.id, u.gym_id, 'event_access',
  'active', true, NOW(), u.unique_id,
  false, false, NOW()
FROM public.users u
WHERE u.gym_id IS NOT NULL
  AND u.access_mode = 'event_access'
  AND u.unique_id IS NOT NULL
  AND (u.unique_id <> '' AND LENGTH(TRIM(u.unique_id)) > 0)
ON CONFLICT (user_id, gym_id, access_mode) DO NOTHING;

-- Sync users.membership_status = 'Active' for event_access (free path = auto-active)
UPDATE public.users u
SET membership_status = 'Active', updated_at = NOW()
WHERE u.gym_id IS NOT NULL
  AND u.access_mode = 'event_access'
  AND u.unique_id IS NOT NULL
  AND TRIM(u.unique_id) <> ''
  AND (u.membership_status IS NULL OR LOWER(TRIM(u.membership_status)) NOT IN ('active', 'approved'));

-- ─── 6. TRIGGER: Create membership for event_access on users update (ID issued) ─
-- Event_access users get ID immediately; they need a membership row for AccessGate on relogin.
CREATE OR REPLACE FUNCTION public.ensure_event_access_membership_on_id_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.access_mode = 'event_access'
     AND NEW.gym_id IS NOT NULL
     AND NEW.unique_id IS NOT NULL
     AND (OLD.unique_id IS NULL OR OLD.unique_id = '' OR OLD.unique_id IS DISTINCT FROM NEW.unique_id)
  THEN
    INSERT INTO public.membership (
      user_id, gym_id, access_mode,
      membership_status, approved, approved_at, unique_member_id,
      calibration_required, calibration_completed, updated_at
    )
    VALUES (
      NEW.id, NEW.gym_id, 'event_access',
      'active', true, NOW(), NEW.unique_id,
      false, false, NOW()
    )
    ON CONFLICT (user_id, gym_id, access_mode) DO UPDATE SET
      membership_status = 'active',
      approved = true,
      approved_at = COALESCE(public.membership.approved_at, NOW()),
      unique_member_id = NEW.unique_id,
      updated_at = NOW();

    -- Sync users.membership_status = 'Active' (event path is free, auto-active)
    UPDATE public.users SET membership_status = 'Active', updated_at = NOW() WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_event_access_membership ON public.users;
CREATE TRIGGER trg_ensure_event_access_membership
  AFTER UPDATE OF unique_id, access_mode, gym_id ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_event_access_membership_on_id_issue();

COMMIT;
