-- ============================================
-- 🚀 MASTER RECOVERY FIX: NOTIFICATIONS & PAYMENTS
-- Run this ONCE to fix all "Missing Column" errors
-- ============================================

-- 1. FIX NOTIFICATIONS TABLE
DO $$
BEGIN
    -- Ensure 'is_read' exists (Critical for triggers)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
        ALTER TABLE public.notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
    END IF;

    -- Ensure 'read' exists (Legacy support)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read') THEN
        ALTER TABLE public.notifications ADD COLUMN read BOOLEAN DEFAULT FALSE;
    END IF;

    -- Ensure 'payment_id' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'payment_id') THEN
        ALTER TABLE public.notifications ADD COLUMN payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL;
    END IF;

    -- Ensure 'priority' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'priority') THEN
        ALTER TABLE public.notifications ADD COLUMN priority INTEGER DEFAULT 3;
    END IF;

    -- Ensure 'status' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'status') THEN
        ALTER TABLE public.notifications ADD COLUMN status TEXT DEFAULT 'unread';
    END IF;
END $$;


-- 2. FIX PAYMENTS TABLE
DO $$
BEGIN
    -- Ensure 'user_id' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'user_id') THEN
        ALTER TABLE public.payments ADD COLUMN user_id UUID REFERENCES public.users(id);
    END IF;

    -- Ensure 'member_id' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'member_id') THEN
        ALTER TABLE public.payments ADD COLUMN member_id UUID REFERENCES public.users(id);
    END IF;

    -- Ensure 'paid_at' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'paid_at') THEN
        ALTER TABLE public.payments ADD COLUMN paid_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Ensure 'payment_date' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payment_date') THEN
        ALTER TABLE public.payments ADD COLUMN payment_date TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Ensure 'status' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'status') THEN
        ALTER TABLE public.payments ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;

    -- Ensure 'payment_status' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payment_status') THEN
        ALTER TABLE public.payments ADD COLUMN payment_status TEXT DEFAULT 'pending';
    END IF;
END $$;


-- 3. RE-INSTALL TRIGGER WITH EXTRA SAFETY
CREATE OR REPLACE FUNCTION notify_admin_on_new_payment()
RETURNS TRIGGER AS $$
DECLARE
  payer_name TEXT;
  currency_amount TEXT;
  target_user_id UUID;
BEGIN
  -- 1. Identify User
  BEGIN
    target_user_id := COALESCE(NEW.user_id, NEW.member_id);
  EXCEPTION WHEN others THEN
    target_user_id := NULL;
  END;

  IF target_user_id IS NOT NULL THEN
    SELECT name INTO payer_name FROM public.users WHERE id = target_user_id;
  END IF;
  
  IF payer_name IS NULL THEN payer_name := 'Member'; END IF;
  currency_amount := COALESCE(NEW.amount::TEXT, '0') || ' ZMW';

  -- 2. Create Notification with Column existence check (using dynamic SQL for ultra-safety)
  EXECUTE 'INSERT INTO public.notifications (user_id, type, message, payment_id, action_url, priority, is_read) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)'
  USING NULL, 'payment_pending', 'New payment of ' || currency_amount || ' from ' || payer_name, NEW.id, '/finances', 2, FALSE;

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- NEVER block the payment insert if notification fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach
DROP TRIGGER IF EXISTS on_payment_created_notify_admin ON public.payments;
CREATE TRIGGER on_payment_created_notify_admin
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_on_new_payment();

-- 4. RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';
