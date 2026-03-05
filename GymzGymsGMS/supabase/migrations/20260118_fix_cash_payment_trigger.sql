-- =================================================================
-- FIX CASH PAYMENT "SILENT FAILURE"
-- Root Cause: Old trigger tries to insert Admin Notification (user_id=NULL)
-- causing RLS violation for the User, rolling back the Payment.
-- Fix: Use SECURITY DEFINER to bypass RLS for the trigger action.
-- =================================================================

-- 1. DROP ALL VARIATIONS OF THE OLD TRIGGER
DROP TRIGGER IF EXISTS trigger_notify_admin_on_payment ON public.payments;
DROP FUNCTION IF EXISTS notify_admin_on_payment();

DROP TRIGGER IF EXISTS on_payment_created_notify_admin ON public.payments;
DROP FUNCTION IF EXISTS notify_admin_on_new_payment();

-- 2. CREATE ROBUST NOTIFICATION FUNCTION (SECURITY DEFINER)
-- This function runs with "Super User" privileges, bypassing RLS
CREATE OR REPLACE FUNCTION notify_admin_on_new_payment()
RETURNS TRIGGER AS $$
DECLARE
  payer_name TEXT;
  currency_amount TEXT;
  target_user_id UUID;
BEGIN
  -- Handle both user_id and member_id for robustness
  target_user_id := COALESCE(NEW.user_id, NEW.member_id);

  -- Safe Name Lookup
  SELECT name INTO payer_name FROM public.users WHERE id = target_user_id;
  IF payer_name IS NULL THEN payer_name := 'Member'; END IF;

  currency_amount := NEW.amount::TEXT || ' ZMW';

  -- Create Notification for ADMIN (user_id = NULL)
  INSERT INTO public.notifications (
    user_id,
    type,
    message,
    payment_id,
    action_url,
    priority,
    is_read
  ) VALUES (
    NULL, -- Targeted at Admin
    'payment_pending',
    'New cash payment of ' || currency_amount || ' from ' || payer_name || ' - Awaiting approval',
    NEW.id,
    '/finances',
    2, -- Urgent
    FALSE
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- <--- CRITICAL FIX

-- 3. RE-ATTACH TRIGGER
CREATE TRIGGER on_payment_created_notify_admin
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_on_new_payment();

-- 4. ENSURE PAYMENTS RLS IS CORRECT (Just in case)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
CREATE POLICY "Users can insert own payments"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  OR 
  auth.uid() = member_id
);

-- 5. RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';
