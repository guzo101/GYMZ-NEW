-- ============================================================================
-- GYMZ: ACCESS GATE — MEMBERSHIP TABLE AS SINGLE SOURCE OF TRUTH
-- Date: 2026-03-21
-- Purpose:
--   Replace users.membership_status / pending-approval flow with a dedicated
--   membership table. One source of truth for gate: membership_status,
--   approved, calibration_completed. RLS: user read own; user update
--   calibration only when approved; admin update status/approved for their gyms.
-- ============================================================================

BEGIN;

-- ─── 1. ENUM for membership status ────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.membership_status_enum AS ENUM ('pending', 'active', 'rejected', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. MEMBERSHIP TABLE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.membership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  access_mode TEXT NOT NULL CHECK (access_mode IN ('gym_access', 'event_access')),
  membership_status public.membership_status_enum NOT NULL DEFAULT 'pending',
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMPTZ,
  unique_member_id TEXT,
  paid_at TIMESTAMPTZ,
  calibration_required BOOLEAN NOT NULL DEFAULT true,
  calibration_completed BOOLEAN NOT NULL DEFAULT false,
  calibration_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, gym_id, access_mode)
);

CREATE INDEX IF NOT EXISTS idx_membership_user_gym_mode
  ON public.membership (user_id, gym_id, access_mode);
CREATE INDEX IF NOT EXISTS idx_membership_user_id ON public.membership (user_id);

COMMENT ON TABLE public.membership IS 'Single source of truth for access gate: pending/active/rejected, approval, calibration.';

-- ─── 3. RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.membership ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User can read own membership" ON public.membership;
CREATE POLICY "User can read own membership"
  ON public.membership FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "User can update calibration only when approved" ON public.membership;
CREATE POLICY "User can update calibration only when approved"
  ON public.membership FOR UPDATE
  USING (auth.uid() = user_id AND approved = true)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can update status and approved for their gyms" ON public.membership;
CREATE POLICY "Admin can update status and approved for their gyms"
  ON public.membership FOR UPDATE
  USING (public.is_gym_admin(gym_id) OR public.is_platform_admin())
  WITH CHECK (true);

-- Admins may need to insert (e.g. manual member add) or leave to trigger
DROP POLICY IF EXISTS "Admin can insert membership for their gyms" ON public.membership;
CREATE POLICY "Admin can insert membership for their gyms"
  ON public.membership FOR INSERT
  WITH CHECK (public.is_gym_admin(gym_id) OR public.is_platform_admin());

-- Service role / triggers need to insert: use SECURITY DEFINER in triggers.

-- ─── 4. RPC: get_membership_for_gate (single source of truth for Access Gate) ─
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
  calibration_completed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.user_id,
    m.gym_id,
    m.access_mode,
    m.membership_status,
    m.approved,
    m.approved_at,
    m.unique_member_id,
    m.paid_at,
    m.calibration_required,
    m.calibration_completed,
    m.calibration_completed_at
  FROM public.membership m
  WHERE m.user_id = p_user_id
    AND m.gym_id = p_gym_id
    AND m.access_mode = p_access_mode
  LIMIT 1;
$$;

-- ─── 5. TRIGGER: On payment INSERT (pending) → upsert membership row ─────────
CREATE OR REPLACE FUNCTION public.sync_membership_on_payment_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gym_id UUID;
  v_access_mode TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    v_gym_id := NEW.gym_id;
    IF v_gym_id IS NULL THEN
      SELECT gym_id, access_mode INTO v_gym_id, v_access_mode
      FROM public.users WHERE id = NEW.user_id;
    ELSE
      SELECT COALESCE(access_mode, 'gym_access') INTO v_access_mode
      FROM public.users WHERE id = NEW.user_id;
    END IF;
    IF v_gym_id IS NOT NULL AND v_access_mode IS NOT NULL THEN
      INSERT INTO public.membership (
        user_id, gym_id, access_mode,
        membership_status, approved, paid_at,
        calibration_required, calibration_completed, updated_at
      )
      VALUES (
        NEW.user_id, v_gym_id, v_access_mode,
        'pending', false, NEW.paid_at,
        (v_access_mode = 'gym_access'), false, NOW()
      )
      ON CONFLICT (user_id, gym_id, access_mode) DO UPDATE SET
        membership_status = 'pending',
        approved = false,
        paid_at = NEW.paid_at,
        updated_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_membership_on_payment_insert ON public.payments;
CREATE TRIGGER trg_sync_membership_on_payment_insert
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_membership_on_payment_insert();

-- ─── 6. TRIGGER: On payment UPDATE to completed/approved → activate membership ─
CREATE OR REPLACE FUNCTION public.sync_membership_on_payment_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_gym_id UUID;
  v_access_mode TEXT;
  v_new_id TEXT;
BEGIN
  v_user_id := COALESCE(NEW.user_id, NEW.member_id);
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
      AND LOWER(TRIM(NEW.status)) IN ('completed', 'approved', 'paid', 'success'))
     OR (TG_OP = 'INSERT' AND LOWER(TRIM(NEW.status)) IN ('completed', 'approved', 'paid', 'success'))
  THEN
    v_gym_id := NEW.gym_id;
    IF v_gym_id IS NULL THEN
      SELECT gym_id, access_mode INTO v_gym_id, v_access_mode FROM public.users WHERE id = v_user_id;
    ELSE
      SELECT COALESCE(access_mode, 'gym_access') INTO v_access_mode FROM public.users WHERE id = v_user_id;
    END IF;

    IF v_gym_id IS NOT NULL THEN
      v_access_mode := COALESCE(v_access_mode, 'gym_access');

      INSERT INTO public.membership (
        user_id, gym_id, access_mode,
        membership_status, approved, approved_at, unique_member_id, paid_at,
        calibration_required, calibration_completed, updated_at
      )
      VALUES (
        v_user_id, v_gym_id, v_access_mode,
        'active', true, NOW(),
        public.generate_gym_member_id(v_gym_id, (v_access_mode = 'event_access')),
        NEW.paid_at,
        (v_access_mode = 'gym_access'), false, NOW()
      )
      ON CONFLICT (user_id, gym_id, access_mode) DO UPDATE SET
        membership_status = 'active',
        approved = true,
        approved_at = NOW(),
        unique_member_id = COALESCE(
          public.membership.unique_member_id,
          public.generate_gym_member_id(v_gym_id, (v_access_mode = 'event_access'))
        ),
        paid_at = COALESCE(public.membership.paid_at, NEW.paid_at),
        updated_at = NOW();

      -- Sync to users for backward compatibility
      SELECT m.unique_member_id INTO v_new_id
      FROM public.membership m
      WHERE m.user_id = v_user_id AND m.gym_id = v_gym_id AND m.access_mode = v_access_mode;

      UPDATE public.users
      SET membership_status = 'Active', unique_id = v_new_id, updated_at = NOW()
      WHERE id = v_user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_membership_on_payment_approved ON public.payments;
CREATE TRIGGER trg_sync_membership_on_payment_approved
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_membership_on_payment_approved();

-- ─── 7. BACKFILL: Existing Active users get a membership row ───────────────
INSERT INTO public.membership (
  user_id, gym_id, access_mode,
  membership_status, approved, approved_at, unique_member_id, paid_at,
  calibration_required, calibration_completed, calibration_completed_at, updated_at
)
SELECT
  u.id,
  u.gym_id,
  COALESCE(u.access_mode, 'gym_access'),
  'active',
  true,
  NOW(),
  u.unique_id,
  NULL,
  (COALESCE(u.access_mode, 'gym_access') = 'gym_access'),
  (u.height IS NOT NULL AND (u.height)::numeric > 0 AND u.weight IS NOT NULL AND (u.weight)::numeric > 0 AND u.age IS NOT NULL AND (u.age)::integer > 0 AND u.gender IS NOT NULL AND u.goal IS NOT NULL),
  CASE WHEN (u.height IS NOT NULL AND (u.height)::numeric > 0 AND u.weight IS NOT NULL AND (u.weight)::numeric > 0 AND u.age IS NOT NULL AND (u.age)::integer > 0 AND u.gender IS NOT NULL AND u.goal IS NOT NULL) THEN NOW() ELSE NULL END,
  NOW()
FROM public.users u
WHERE u.gym_id IS NOT NULL
  AND LOWER(TRIM(COALESCE(u.membership_status, ''))) IN ('active', 'approved')
ON CONFLICT (user_id, gym_id, access_mode) DO NOTHING;

-- ─── 8. RPC: Set calibration completed (called from app after HealthMetrics save) ─
CREATE OR REPLACE FUNCTION public.set_membership_calibration_completed(
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

  UPDATE public.membership
  SET calibration_completed = true, calibration_completed_at = NOW(), updated_at = NOW()
  WHERE user_id = p_user_id AND gym_id = p_gym_id AND access_mode = p_access_mode AND approved = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'membership_not_found_or_not_approved');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

COMMIT;
