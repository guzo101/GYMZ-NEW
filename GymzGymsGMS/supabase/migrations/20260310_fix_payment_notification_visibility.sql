-- ============================================================================
-- GYMZ: FIX PAYMENT NOTIFICATION VISIBILITY FOR ADMINS
-- Date: 2026-03-10
-- Problem: Admins see payments in Recent Activity / Audit Log but NOT in the
--          notification bell. Root causes:
--   1. Notifications may have gym_id NULL (orphaned) - admin RLS requires gym_id
--   2. ensure_payment_gym_id must run before notify - verify trigger order
-- ============================================================================

BEGIN;

-- ─── 1. BACKFILL gym_id ON ORPHANED NOTIFICATIONS ───────────────────────────
-- Notifications with payment_id but gym_id NULL are invisible to admins.
UPDATE public.notifications n
SET gym_id = p.gym_id
FROM public.payments p
WHERE n.payment_id = p.id
  AND n.gym_id IS NULL
  AND p.gym_id IS NOT NULL;

-- If payment also lacked gym_id, backfill from payer's user record
UPDATE public.notifications n
SET gym_id = u.gym_id
FROM public.payments p
JOIN public.users u ON u.id = COALESCE(p.user_id, p.member_id)
WHERE n.payment_id = p.id
  AND n.gym_id IS NULL
  AND u.gym_id IS NOT NULL;


-- ─── 2. HARDEN notify_admin_on_new_payment: ALWAYS use payment.gym_id as fallback ─
-- Ensure we never insert with gym_id NULL when the payment has it.
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_payer_name TEXT;
  v_target_user_id UUID;
  v_gym_id UUID;
BEGIN
  v_target_user_id := COALESCE(NEW.user_id, NEW.member_id);

  -- Primary: gym_id from payer's user record
  SELECT name, gym_id INTO v_payer_name, v_gym_id
  FROM public.users WHERE id = v_target_user_id;

  IF v_payer_name IS NULL THEN v_payer_name := 'Member'; END IF;

  -- Fallback 1: payment row (ensure_payment_gym_id sets this BEFORE INSERT)
  IF v_gym_id IS NULL THEN v_gym_id := NEW.gym_id; END IF;

  -- Fallback 2: plan's gym (if payment has plan_id)
  IF v_gym_id IS NULL AND NEW.plan_id IS NOT NULL THEN
    SELECT gym_id INTO v_gym_id FROM public.gym_membership_plans WHERE id = NEW.plan_id LIMIT 1;
  END IF;

  -- Only insert if we have a valid gym_id - otherwise admin cannot see it (RLS)
  IF v_gym_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, gym_id, type, message, payment_id, priority, is_read, status, action_url, action_label
    ) VALUES (
      NULL,
      v_gym_id,
      'payment_pending',
      'New payment of ' || NEW.amount || ' from ' || v_payer_name,
      NEW.id,
      2,
      FALSE,
      'unread',
      '/finances',
      'Review Payment'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 3. ENSURE ensure_payment_gym_id TRIGGER EXISTS (BEFORE INSERT) ──────────
-- Must run before notify_admin_on_new_payment so NEW.gym_id is set.
CREATE OR REPLACE FUNCTION public.ensure_payment_gym_id()
RETURNS TRIGGER AS $$
DECLARE
  v_user_gym_id UUID;
BEGIN
  IF NEW.gym_id IS NULL THEN
    SELECT gym_id INTO v_user_gym_id
    FROM public.users
    WHERE id = COALESCE(NEW.user_id, NEW.member_id);
    IF v_user_gym_id IS NOT NULL THEN
      NEW.gym_id := v_user_gym_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_payment_gym_id_trg ON public.payments;
CREATE TRIGGER ensure_payment_gym_id_trg
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_payment_gym_id();


COMMIT;

NOTIFY pgrst, 'reload schema';
