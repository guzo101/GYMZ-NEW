-- ============================================================================
-- DEFINITIVE OAC RLS FIX
-- Date: 2026-03-01
--
-- This migration is the single source of truth for ALL OAC-related RLS.
-- It drops ALL existing policies on the affected tables and recreates them
-- from scratch with the correct, tested rules.
--
-- WHO NEEDS ACCESS:
--   1. Platform Admins (role = 'platform_admin' or 'super_admin')
--      → Full read/write on ALL gym data across ALL gyms (they manage the OAC)
--   2. Gym Admins/Owners (role = 'admin' or 'owner', scoped by gym_id)
--      → Full read/write on THEIR OWN gym's data only
--   3. Public / App Users
--      → Read-only on active gyms and public-facing data
-- ============================================================================

BEGIN;

-- ─── HELPER FUNCTIONS (idempotent) ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('platform_admin', 'super_admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_gym_admin(p_gym_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND gym_id = p_gym_id
        AND role IN ('admin', 'super_admin', 'owner')
    );
$$;

-- Convenience: does the current user belong to this gym (any role)?
CREATE OR REPLACE FUNCTION public.user_belongs_to_gym(p_gym_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND gym_id = p_gym_id
    );
$$;


-- ─── 1. GYMS TABLE ──────────────────────────────────────────────────────────
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

-- Drop every known policy on gyms to start clean
DROP POLICY IF EXISTS "Platform admins have full access to gyms" ON public.gyms;
DROP POLICY IF EXISTS "Gym owners can view their own gym" ON public.gyms;
DROP POLICY IF EXISTS "Public can read active gyms" ON public.gyms;
DROP POLICY IF EXISTS "Anyone can read gyms" ON public.gyms;

-- Platform admins: full CRUD on all gyms
CREATE POLICY "platform_admin_gyms_all"
ON public.gyms FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- Gym admin/owner: read their own gym (any status)
CREATE POLICY "gym_admin_gyms_select"
ON public.gyms FOR SELECT
USING (public.user_belongs_to_gym(id));

-- App/public: only active gyms
CREATE POLICY "public_gyms_active_select"
ON public.gyms FOR SELECT
USING (status = 'active');


-- ─── 2. GYM_ONBOARDING_STATUS ───────────────────────────────────────────────
ALTER TABLE public.gym_onboarding_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage onboarding status" ON public.gym_onboarding_status;
DROP POLICY IF EXISTS "Gym admins can view their onboarding status" ON public.gym_onboarding_status;
DROP POLICY IF EXISTS "table_onboarding_gym_isolation" ON public.gym_onboarding_status;
DROP POLICY IF EXISTS "Gym owners can read their onboarding status" ON public.gym_onboarding_status;

-- Platform admins: full CRUD
CREATE POLICY "platform_admin_onboarding_all"
ON public.gym_onboarding_status FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- Gym admin/owner: read + update their own
CREATE POLICY "gym_admin_onboarding_select"
ON public.gym_onboarding_status FOR SELECT
USING (public.is_gym_admin(gym_id) OR public.user_belongs_to_gym(gym_id));

CREATE POLICY "gym_admin_onboarding_update"
ON public.gym_onboarding_status FOR UPDATE
USING (public.is_gym_admin(gym_id))
WITH CHECK (public.is_gym_admin(gym_id));


-- ─── 3. GYM_CONTACTS ────────────────────────────────────────────────────────
ALTER TABLE public.gym_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage gym contacts" ON public.gym_contacts;
DROP POLICY IF EXISTS "Gym owners can manage their contacts" ON public.gym_contacts;

CREATE POLICY "platform_admin_contacts_all"
ON public.gym_contacts FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "gym_admin_contacts_all"
ON public.gym_contacts FOR ALL
USING (public.is_gym_admin(gym_id))
WITH CHECK (public.is_gym_admin(gym_id));


-- ─── 4. GYM_BRANCHES ────────────────────────────────────────────────────────
ALTER TABLE public.gym_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage branches" ON public.gym_branches;
DROP POLICY IF EXISTS "Gym admins can view their branches" ON public.gym_branches;
DROP POLICY IF EXISTS "Gym owners can manage their branches" ON public.gym_branches;

CREATE POLICY "platform_admin_branches_all"
ON public.gym_branches FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "gym_admin_branches_all"
ON public.gym_branches FOR ALL
USING (public.is_gym_admin(gym_id))
WITH CHECK (public.is_gym_admin(gym_id));


-- ─── 5. GYM_HOURS ───────────────────────────────────────────────────────────
ALTER TABLE public.gym_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage gym hours" ON public.gym_hours;
DROP POLICY IF EXISTS "Public can read gym hours" ON public.gym_hours;
DROP POLICY IF EXISTS "Gym owners can manage their hours" ON public.gym_hours;

CREATE POLICY "platform_admin_hours_all"
ON public.gym_hours FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "gym_admin_hours_all"
ON public.gym_hours FOR ALL
USING (public.is_gym_admin(gym_id))
WITH CHECK (public.is_gym_admin(gym_id));

CREATE POLICY "public_hours_select"
ON public.gym_hours FOR SELECT
USING (true);


-- ─── 6. GYM_MEMBERSHIP_PLANS ────────────────────────────────────────────────
ALTER TABLE public.gym_membership_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage gym plans" ON public.gym_membership_plans;
DROP POLICY IF EXISTS "Public can read active gym plans" ON public.gym_membership_plans;
DROP POLICY IF EXISTS "Gym owners can manage their plans" ON public.gym_membership_plans;

CREATE POLICY "platform_admin_plans_all"
ON public.gym_membership_plans FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "gym_admin_plans_all"
ON public.gym_membership_plans FOR ALL
USING (public.is_gym_admin(gym_id))
WITH CHECK (public.is_gym_admin(gym_id));

CREATE POLICY "public_plans_active_select"
ON public.gym_membership_plans FOR SELECT
USING (is_active = true);


-- ─── 7. GYM_FACILITIES_EQUIPMENT ────────────────────────────────────────────
ALTER TABLE public.gym_facilities_equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage facilities" ON public.gym_facilities_equipment;
DROP POLICY IF EXISTS "Public can read facilities" ON public.gym_facilities_equipment;
DROP POLICY IF EXISTS "Gym owners can manage their facilities" ON public.gym_facilities_equipment;

CREATE POLICY "platform_admin_facilities_all"
ON public.gym_facilities_equipment FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "gym_admin_facilities_all"
ON public.gym_facilities_equipment FOR ALL
USING (public.is_gym_admin(gym_id))
WITH CHECK (public.is_gym_admin(gym_id));

CREATE POLICY "public_facilities_select"
ON public.gym_facilities_equipment FOR SELECT
USING (true);


-- ─── 8. GYM_MEDIA_ASSETS ────────────────────────────────────────────────────
ALTER TABLE public.gym_media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage gym media" ON public.gym_media_assets;
DROP POLICY IF EXISTS "Public can read gym media" ON public.gym_media_assets;
DROP POLICY IF EXISTS "Gym owners can manage their media" ON public.gym_media_assets;

CREATE POLICY "platform_admin_media_all"
ON public.gym_media_assets FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "gym_admin_media_all"
ON public.gym_media_assets FOR ALL
USING (public.is_gym_admin(gym_id))
WITH CHECK (public.is_gym_admin(gym_id));

CREATE POLICY "public_media_select"
ON public.gym_media_assets FOR SELECT
USING (true);


-- ─── 9. GYM_PAYMENT_METHODS ─────────────────────────────────────────────────
ALTER TABLE public.gym_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage payment methods" ON public.gym_payment_methods;
DROP POLICY IF EXISTS "Public can read active payment methods" ON public.gym_payment_methods;
DROP POLICY IF EXISTS "Gym owners can manage their payment methods" ON public.gym_payment_methods;

CREATE POLICY "platform_admin_payments_all"
ON public.gym_payment_methods FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "gym_admin_payments_all"
ON public.gym_payment_methods FOR ALL
USING (public.is_gym_admin(gym_id))
WITH CHECK (public.is_gym_admin(gym_id));

CREATE POLICY "public_payments_active_select"
ON public.gym_payment_methods FOR SELECT
USING (is_active = true);


-- ─── 10. GYM_VERIFICATION_DOCUMENTS ─────────────────────────────────────────
ALTER TABLE public.gym_verification_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage verification docs" ON public.gym_verification_documents;
DROP POLICY IF EXISTS "Gym owners can manage their verification docs" ON public.gym_verification_documents;

CREATE POLICY "platform_admin_docs_all"
ON public.gym_verification_documents FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "gym_admin_docs_all"
ON public.gym_verification_documents FOR ALL
USING (public.is_gym_admin(gym_id))
WITH CHECK (public.is_gym_admin(gym_id));


-- ─── 11. BACKFILL COMPLETENESS SCORES ────────────────────────────────────────
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.gyms LOOP
        PERFORM public.refresh_gym_completeness_score(r.id);
    END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
