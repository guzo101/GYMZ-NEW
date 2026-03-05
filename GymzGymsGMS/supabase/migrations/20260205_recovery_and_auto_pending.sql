-- ================================================================================
-- RECOVERY & AUTO-PENDING TRIGGERS
-- Fixes: relation "membership_tiers" does not exist
-- Fixes: User navigation loop (RLS blockage)
-- ================================================================================

BEGIN;

-- 1. Ensure Membership Tiers Table Exists
CREATE TABLE IF NOT EXISTS public.membership_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    price_zmw NUMERIC NOT NULL,
    duration_days INTEGER NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Seed/Verify Tiers
INSERT INTO public.membership_tiers (name, description, price_zmw, duration_days)
VALUES 
    ('Day Pass', 'Access for 24 hours until midnight', 100, 1),
    ('Basic', 'Standard Monthly Membership', 800, 30),
    ('Couple', 'Monthly Membership for two people', 1500, 30),
    ('Family', 'Monthly Membership for family of 5', 3500, 30)
ON CONFLICT (name) DO UPDATE SET 
    price_zmw = EXCLUDED.price_zmw,
    active = true;

-- 3. Ensure Dependent Tables Exist
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    tier_id UUID REFERENCES public.membership_tiers(id) NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    auto_renew BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'ZMW',
    type TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id UUID NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.users(id) NOT NULL,
    target_user_id UUID REFERENCES public.users(id) NOT NULL,
    action_type TEXT NOT NULL,
    old_state JSONB,
    new_state JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AUTO-PENDING TRIGGER
-- This ensures that when a user pays, their status is set to 'Pending' automatically.
-- This bypasses RLS issues where the App cannot update the users table directly.

CREATE OR REPLACE FUNCTION public.handle_new_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger for newly created payments that are pending approval
    IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
        UPDATE public.users 
        SET membership_status = 'Pending',
            payment_status = 'pending',
            access_mode = 'gym_access', -- Ensure they move out of event_mode immediately
            updated_at = NOW()
        WHERE id = NEW.user_id;
        
        RAISE NOTICE 'User status auto-updated to Pending and Gym Access for user %', NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_pending_user ON public.payments;
CREATE TRIGGER trg_auto_pending_user
AFTER INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_payment_status();

-- 5. Backfill: Fix users who have pending payments but are stuck as 'Inactive'
UPDATE public.users u
SET membership_status = 'Pending',
    payment_status = 'pending'
FROM public.payments p
WHERE p.user_id = u.id
  AND p.status = 'pending'
  AND (u.membership_status IS NULL OR u.membership_status = 'Inactive');

COMMIT;
