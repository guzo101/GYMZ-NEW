-- ============================================================================
-- OAC RLS POLICIES MIGRATION
-- Row Level Security for all Owner Admin Console tables
-- Date: 2026-02-22
-- ============================================================================

-- Helper function: check if current user is a platform admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('platform_admin', 'super_admin')
    );
$$;

-- ─── gym_onboarding_status ─────────────────────────────────────────────────
ALTER TABLE public.gym_onboarding_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage onboarding status" ON public.gym_onboarding_status;
CREATE POLICY "Platform admins manage onboarding status"
ON public.gym_onboarding_status FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Gym admins can view their onboarding status" ON public.gym_onboarding_status;
CREATE POLICY "Gym admins can view their onboarding status"
ON public.gym_onboarding_status FOR SELECT
USING (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()));

-- ─── gym_branches ──────────────────────────────────────────────────────────
ALTER TABLE public.gym_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage branches" ON public.gym_branches;
CREATE POLICY "Platform admins manage branches"
ON public.gym_branches FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Gym admins can view their branches" ON public.gym_branches;
CREATE POLICY "Gym admins can view their branches"
ON public.gym_branches FOR SELECT
USING (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()));

-- ─── gym_contacts ──────────────────────────────────────────────────────────
ALTER TABLE public.gym_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage gym contacts" ON public.gym_contacts;
CREATE POLICY "Platform admins manage gym contacts"
ON public.gym_contacts FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- ─── gym_verification_documents ────────────────────────────────────────────
ALTER TABLE public.gym_verification_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage verification docs" ON public.gym_verification_documents;
CREATE POLICY "Platform admins manage verification docs"
ON public.gym_verification_documents FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- ─── gym_hours ─────────────────────────────────────────────────────────────
ALTER TABLE public.gym_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage gym hours" ON public.gym_hours;
CREATE POLICY "Platform admins manage gym hours"
ON public.gym_hours FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Public can read gym hours" ON public.gym_hours;
CREATE POLICY "Public can read gym hours"
ON public.gym_hours FOR SELECT
USING (true);

-- ─── gym_media_assets ──────────────────────────────────────────────────────
ALTER TABLE public.gym_media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage gym media" ON public.gym_media_assets;
CREATE POLICY "Platform admins manage gym media"
ON public.gym_media_assets FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Public can read gym media" ON public.gym_media_assets;
CREATE POLICY "Public can read gym media"
ON public.gym_media_assets FOR SELECT
USING (true);

-- ─── admin_audit_logs ──────────────────────────────────────────────────────
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Platform admins can insert audit logs"
ON public.admin_audit_logs FOR INSERT
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can read audit logs" ON public.admin_audit_logs;
CREATE POLICY "Platform admins can read audit logs"
ON public.admin_audit_logs FOR SELECT
USING (public.is_platform_admin());

-- NO UPDATE or DELETE policies on audit_logs — INSERT ONLY by design.

-- ─── gym_membership_plans ──────────────────────────────────────────────────
ALTER TABLE public.gym_membership_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage gym plans" ON public.gym_membership_plans;
CREATE POLICY "Platform admins manage gym plans"
ON public.gym_membership_plans FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Public can read active gym plans" ON public.gym_membership_plans;
CREATE POLICY "Public can read active gym plans"
ON public.gym_membership_plans FOR SELECT
USING (is_active = true);

-- ─── gym_promotions ────────────────────────────────────────────────────────
ALTER TABLE public.gym_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage gym promotions" ON public.gym_promotions;
CREATE POLICY "Platform admins manage gym promotions"
ON public.gym_promotions FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- ─── gym_facilities_equipment ──────────────────────────────────────────────
ALTER TABLE public.gym_facilities_equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage facilities" ON public.gym_facilities_equipment;
CREATE POLICY "Platform admins manage facilities"
ON public.gym_facilities_equipment FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Public can read facilities" ON public.gym_facilities_equipment;
CREATE POLICY "Public can read facilities"
ON public.gym_facilities_equipment FOR SELECT
USING (true);

-- ─── gym_trainers ──────────────────────────────────────────────────────────
ALTER TABLE public.gym_trainers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage trainers" ON public.gym_trainers;
CREATE POLICY "Platform admins manage trainers"
ON public.gym_trainers FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Public can read active trainers" ON public.gym_trainers;
CREATE POLICY "Public can read active trainers"
ON public.gym_trainers FOR SELECT
USING (is_active = true);

-- ─── gym_classes + gym_class_schedules ─────────────────────────────────────
ALTER TABLE public.gym_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_class_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage gym classes" ON public.gym_classes;
CREATE POLICY "Platform admins manage gym classes"
ON public.gym_classes FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Public can read active classes" ON public.gym_classes;
CREATE POLICY "Public can read active classes"
ON public.gym_classes FOR SELECT
USING (is_active = true);

DROP POLICY IF EXISTS "Platform admins manage class schedules" ON public.gym_class_schedules;
CREATE POLICY "Platform admins manage class schedules"
ON public.gym_class_schedules FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Public can read published schedules" ON public.gym_class_schedules;
CREATE POLICY "Public can read published schedules"
ON public.gym_class_schedules FOR SELECT
USING (is_published = true);

-- ─── gym_payment_methods ───────────────────────────────────────────────────
ALTER TABLE public.gym_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage payment methods" ON public.gym_payment_methods;
CREATE POLICY "Platform admins manage payment methods"
ON public.gym_payment_methods FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Public can read active payment methods" ON public.gym_payment_methods;
CREATE POLICY "Public can read active payment methods"
ON public.gym_payment_methods FOR SELECT
USING (is_active = true);

-- ─── gym_receipt_rules ─────────────────────────────────────────────────────
ALTER TABLE public.gym_receipt_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage receipt rules" ON public.gym_receipt_rules;
CREATE POLICY "Platform admins manage receipt rules"
ON public.gym_receipt_rules FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- ─── gym_discovery_settings ────────────────────────────────────────────────
ALTER TABLE public.gym_discovery_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage discovery settings" ON public.gym_discovery_settings;
CREATE POLICY "Platform admins manage discovery settings"
ON public.gym_discovery_settings FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "Public can read discovery settings" ON public.gym_discovery_settings;
CREATE POLICY "Public can read discovery settings"
ON public.gym_discovery_settings FOR SELECT
USING (is_discoverable = true);

NOTIFY pgrst, 'reload schema';
