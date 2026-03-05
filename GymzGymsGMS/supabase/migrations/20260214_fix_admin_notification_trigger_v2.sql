-- =================================================================
-- FIX ADMIN NOTIFICATIONS (FINAL)
-- Root Cause: A previous migration overwrote the notification logic, 
-- causing notifications to be assigned to users (instead of NULL/Admin)
-- and using the wrong type ('payment' instead of 'payment_pending').
-- =================================================================

-- 1. DROP THE INCORRECT TRIGGERS AND FUNCTIONS
DROP TRIGGER IF EXISTS trigger_notify_admin_on_payment ON public.payments;
DROP FUNCTION IF EXISTS public.notify_admin_on_payment();

DROP TRIGGER IF EXISTS on_payment_created_notify_admin ON public.payments;
DROP FUNCTION IF EXISTS public.notify_admin_on_new_payment();

-- 1b. ENSURE ADMIN CHECK FUNCTION EXISTS (Idempotent)
CREATE OR REPLACE FUNCTION public.check_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
$$;

-- 2. CREATE THE CORRECT NOTIFICATION FUNCTION (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_payment()
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
    is_read,
    status
  ) VALUES (
    NULL, -- Targeted at Admin (CRITICAL)
    'payment_pending', -- Correct type for Admin Filter
    'New payment of ' || currency_amount || ' from ' || payer_name || ' - Awaiting approval',
    NEW.id,
    '/finances',
    2, -- Urgent
    FALSE,
    'unread'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ATTACH THE CORRECT TRIGGER
CREATE TRIGGER on_payment_created_notify_admin
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_new_payment();

-- 4. REPAIR EXISTING "INVISIBLE" NOTIFICATIONS
-- Convert 'payment' type to 'payment_pending' and re-assign to Admin (user_id = NULL)
UPDATE public.notifications
SET 
  type = 'payment_pending',
  user_id = NULL,
  priority = 2,
  action_url = '/finances'
WHERE 
  type = 'payment' 
  AND payment_id IS NOT NULL;

-- 5. ENSURE RLS ALLOWS ADMINS TO SEE THESE
DROP POLICY IF EXISTS "Admins Full Access" ON public.notifications;
CREATE POLICY "Admins Full Access"
ON public.notifications
FOR ALL
TO authenticated
USING (
  public.check_user_is_admin()
  OR auth.jwt() ->> 'role' = 'service_role'
);

-- Force schema reload
NOTIFY pgrst, 'reload schema';
