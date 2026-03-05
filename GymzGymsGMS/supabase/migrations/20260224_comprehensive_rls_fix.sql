-- ============================================================================
-- OAC RLS COMPREHENSIVE FIX
-- Fixes missing policies that were blocking gym owners from viewing/managing
-- their own onboarding data, causing 0% scores and empty checklists.
-- ============================================================================

-- 1. Ensure gym owners can actually view their own gym record
DROP POLICY IF EXISTS "Gym owners can view their own gym" ON public.gyms;
CREATE POLICY "Gym owners can view their own gym"
ON public.gyms FOR SELECT
USING (id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()));

-- 2. Fix gym_onboarding_status (Select for owners)
-- Already exists but let's re-ensure it's robust
DROP POLICY IF EXISTS "Gym admins can view their onboarding status" ON public.gym_onboarding_status;
CREATE POLICY "Gym admins can view their onboarding status"
ON public.gym_onboarding_status FOR SELECT
USING (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()));

-- 3. Fix gym_contacts (All for owners)
DROP POLICY IF EXISTS "Gym owners can manage their contacts" ON public.gym_contacts;
CREATE POLICY "Gym owners can manage their contacts"
ON public.gym_contacts FOR ALL
USING (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()))
WITH CHECK (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()));

-- 4. Fix gym_branches (All for owners)
DROP POLICY IF EXISTS "Gym owners can manage their branches" ON public.gym_branches;
CREATE POLICY "Gym owners can manage their branches"
ON public.gym_branches FOR ALL
USING (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()))
WITH CHECK (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()));

-- 5. Fix gym_hours (All for owners)
DROP POLICY IF EXISTS "Gym owners can manage their hours" ON public.gym_hours;
CREATE POLICY "Gym owners can manage their hours"
ON public.gym_hours FOR ALL
USING (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()))
WITH CHECK (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()));

-- 6. Fix gym_membership_plans (All for owners)
DROP POLICY IF EXISTS "Gym owners can manage their plans" ON public.gym_membership_plans;
CREATE POLICY "Gym owners can manage their plans"
ON public.gym_membership_plans FOR ALL
USING (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()))
WITH CHECK (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()));

-- 7. Fix gym_facilities_equipment (All for owners)
DROP POLICY IF EXISTS "Gym owners can manage their facilities" ON public.gym_facilities_equipment;
CREATE POLICY "Gym owners can manage their facilities"
ON public.gym_facilities_equipment FOR ALL
USING (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()))
WITH CHECK (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()));

-- 8. Fix gym_media_assets (All for owners)
DROP POLICY IF EXISTS "Gym owners can manage their media" ON public.gym_media_assets;
CREATE POLICY "Gym owners can manage their media"
ON public.gym_media_assets FOR ALL
USING (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()))
WITH CHECK (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()));

-- 9. Fix gym_verification_documents (All for owners)
DROP POLICY IF EXISTS "Gym owners can manage their verification docs" ON public.gym_verification_documents;
CREATE POLICY "Gym owners can manage their verification docs"
ON public.gym_verification_documents FOR ALL
USING (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()))
WITH CHECK (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()));

-- 10. Fix gym_payment_methods (All for owners)
DROP POLICY IF EXISTS "Gym owners can manage their payment methods" ON public.gym_payment_methods;
CREATE POLICY "Gym owners can manage their payment methods"
ON public.gym_payment_methods FOR ALL
USING (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()))
WITH CHECK (gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid()));

-- 11. Finally, force recalculate everything one more time now that permissions are fixed
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.gyms LOOP
        PERFORM public.refresh_gym_completeness_score(r.id);
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
