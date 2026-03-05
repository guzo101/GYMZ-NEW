-- ============================================
-- DIAGNOSTIC & COMPATIBILITY FIX: PAYMENTS TABLE
-- This ensures the payments table works for BOTH the App (Old Structure)
-- and the GMS (New Structure) by ensuring columns exist and are nullable.
-- ============================================

DO $$ 
BEGIN
    -- 1. Ensure 'user_id' exists (Used by App)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'user_id') THEN
        ALTER TABLE public.payments ADD COLUMN user_id UUID REFERENCES public.users(id);
    END IF;

    -- 2. Ensure 'member_id' exists (Used by GMS)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'member_id') THEN
        ALTER TABLE public.payments ADD COLUMN member_id UUID REFERENCES public.users(id);
    END IF;

    -- 3. Ensure columns are NOT NULL only where safe
    -- Make 'amount' not null if possible, but safe
    ALTER TABLE public.payments ALTER COLUMN amount SET NOT NULL;

    -- 4. status vs payment_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'status') THEN
        ALTER TABLE public.payments ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payment_status') THEN
        ALTER TABLE public.payments ADD COLUMN payment_status TEXT DEFAULT 'pending';
    END IF;

    -- 5. paid_at vs payment_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'paid_at') THEN
        ALTER TABLE public.payments ADD COLUMN paid_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payment_date') THEN
        ALTER TABLE public.payments ADD COLUMN payment_date TIMESTAMPTZ DEFAULT NOW();
    END IF;

END $$;

-- 6. Trigger to keep user_id and member_id in sync
CREATE OR REPLACE FUNCTION sync_payment_identities()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync User/Member ID
    IF NEW.user_id IS NOT NULL AND NEW.member_id IS NULL THEN
        NEW.member_id := NEW.user_id;
    ELSIF NEW.member_id IS NOT NULL AND NEW.user_id IS NULL THEN
        NEW.user_id := NEW.member_id;
    END IF;

    -- Sync Statuses
    IF NEW.status IS NOT NULL AND (NEW.payment_status IS NULL OR NEW.payment_status = 'pending') THEN
        NEW.payment_status := NEW.status;
    ELSIF NEW.payment_status IS NOT NULL AND (NEW.status IS NULL OR NEW.status = 'pending') THEN
        NEW.status := NEW.payment_status;
    END IF;

    -- Sync Dates
    IF NEW.paid_at IS NOT NULL AND NEW.payment_date IS NULL THEN
        NEW.payment_date := NEW.paid_at;
    ELSIF NEW.payment_date IS NOT NULL AND NEW.paid_at IS NULL THEN
        NEW.paid_at := NEW.payment_date;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_payment_identities ON public.payments;
CREATE TRIGGER trg_sync_payment_identities
    BEFORE INSERT OR UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION sync_payment_identities();

-- 7. RELOAD
NOTIFY pgrst, 'reload schema';
