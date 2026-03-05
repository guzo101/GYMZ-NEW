-- ================================================================================
-- INTELLIGENT PAYMENT & ENTITLEMENT SYSTEM (LEDGER-BASED)
-- Generated: 2026-02-04
-- ================================================================================

BEGIN;

-- 1. Membership Tiers (The Plans)
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

-- Seed initial tiers based on existing app logic
INSERT INTO public.membership_tiers (name, description, price_zmw, duration_days)
VALUES 
    ('Day Pass', 'Access for 24 hours until midnight', 100, 1),
    ('Basic', 'Standard Monthly Membership', 800, 30),
    ('Couple', 'Monthly Membership for two people', 1500, 30),
    ('Family', 'Monthly Membership for family of 5', 3500, 30)
ON CONFLICT (name) DO NOTHING;

-- 2. Subscriptions (The Contract)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    tier_id UUID REFERENCES public.membership_tiers(id) NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_payment', 'active', 'grace_period', 'suspended', 'cancelled', 'expired')),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    auto_renew BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ledger Entries (The Bank)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC NOT NULL, -- Positive for credit, negative for debit
    currency TEXT DEFAULT 'ZMW',
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    source_type TEXT NOT NULL CHECK (source_type IN ('payment', 'refund', 'admin_grant', 'subscription_purchase')),
    source_id UUID NOT NULL, -- Can be payment_id, admin_action_id, or subscription_id
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Audit Log for Admin Actions
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

-- 5. Helper Function: Calculate Ledger Balance
CREATE OR REPLACE FUNCTION public.get_user_ledger_balance(p_user_id UUID)
RETURNS NUMERIC AS $$
    SELECT COALESCE(SUM(amount), 0) FROM public.ledger_entries WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE;

-- 6. Trigger: Auto-Update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_membership_tiers_modtime BEFORE UPDATE ON public.membership_tiers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_subscriptions_modtime BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 7. Secure Access: RLS Policies
ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view tiers
CREATE POLICY "Users can view tiers" ON public.membership_tiers FOR SELECT TO authenticated USING (true);

-- Users can view their own subscriptions and ledger
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own ledger" ON public.ledger_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admins can do everything
CREATE POLICY "Admins full access to tiers" ON public.membership_tiers TO authenticated 
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins full access to subscriptions" ON public.subscriptions TO authenticated 
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins full access to ledger" ON public.ledger_entries TO authenticated 
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

COMMIT;
