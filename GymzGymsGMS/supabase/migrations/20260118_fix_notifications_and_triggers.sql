-- ============================================
-- FIX NOTIFICATIONS SYSTEM
-- 1. Ensure Table Structure
-- 2. Fix RLS Policies (Critical for Admin -> User notifications)
-- 3. Restore/Fix Triggers (Critical for User -> Admin notifications)
-- ============================================

-- 1. Ensure Notifications Table Structure
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- NULL for Admin
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read BOOLEAN DEFAULT FALSE, -- Legacy support
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    member_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action_url TEXT,
    action_label TEXT,
    priority INTEGER DEFAULT 3, -- 1=Critical, 2=Urgent, 3=Standard, 4=Low
    status TEXT DEFAULT 'unread',
    platform_origin TEXT DEFAULT 'gms',
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Fix Double Column Confusion (is_read vs read)
-- We will use a trigger to keep them in sync if both exist
CREATE OR REPLACE FUNCTION sync_notification_read_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_read IS DISTINCT FROM OLD.is_read THEN
        NEW.read := NEW.is_read;
    ELSIF NEW.read IS DISTINCT FROM OLD.read THEN
        NEW.is_read := NEW.read;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_notification_read_sync ON notifications;
CREATE TRIGGER on_notification_read_sync
    BEFORE INSERT OR UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION sync_notification_read_status();


-- 2. RLS POLICIES
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Reset existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins Full Access" ON public.notifications;
DROP POLICY IF EXISTS "Users View Own" ON public.notifications;
DROP POLICY IF EXISTS "Users Update Own" ON public.notifications;
DROP POLICY IF EXISTS "service_role_all" ON public.notifications;

-- Policy A: ADMINS & SERVICE ROLE (Full Access)
-- This allows GMS (Admin) to insert notifications for Users
CREATE POLICY "Admins Full Access"
ON public.notifications
FOR ALL
USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin')
  OR auth.jwt() ->> 'role' = 'service_role'
);

-- Policy B: USERS (View/Update Own)
-- Users can see notifications where user_id matches their ID
CREATE POLICY "Users Own Data"
ON public.notifications
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. PAYMENT TRIGGERS

-- Function: Notify Admin when a New Payment is created (Pending)
CREATE OR REPLACE FUNCTION notify_admin_on_new_payment()
RETURNS TRIGGER AS $$
DECLARE
  payer_name TEXT;
  currency_amount TEXT;
  target_user_id UUID;
BEGIN
  -- Handle potential column differences (user_id vs member_id)
  -- This makes the trigger robust regardless of which schema version is active
  BEGIN
    target_user_id := COALESCE(NEW.user_id, NEW.member_id);
  EXCEPTION WHEN others THEN
    -- Fallback if one of the columns doesn't exist in the NEW record
    BEGIN
      target_user_id := NEW.user_id;
    EXCEPTION WHEN others THEN
      BEGIN
        target_user_id := NEW.member_id;
      EXCEPTION WHEN others THEN
        target_user_id := NULL;
      END;
    END;
  END;

  -- Get payer name
  IF target_user_id IS NOT NULL THEN
    SELECT name INTO payer_name FROM public.users WHERE id = target_user_id;
  END IF;
  
  IF payer_name IS NULL THEN payer_name := 'Unknown Member'; END IF;

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
    'New payment of ' || currency_amount || ' from ' || payer_name || ' - Awaiting approval',
    NEW.id,
    '/finances',
    2, -- Urgent
    FALSE
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER allows it to insert even if user doesn't have permissions

-- Create Trigger (Only on Insert)
DROP TRIGGER IF EXISTS on_payment_created_notify_admin ON public.payments;
CREATE TRIGGER on_payment_created_notify_admin
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_on_new_payment();


-- Note: We generally rely on the App/GMS Logic to send "Approved" notifications to avoid duplicates.
-- However, we will ensure that if the status changes to COMPLETED and no notification exists recently, we might want to safeguard it.
-- For now, relying on GMS Logic + RLS Fix is safer to prevent duplicates. 
-- The Code in Finances.tsx calls notifyPaymentApproved() which inserts into notifications.
-- The RLS policy "Admins Full Access" now allows this insert.

-- 4. Reload Schema
NOTIFY pgrst, 'reload schema';
