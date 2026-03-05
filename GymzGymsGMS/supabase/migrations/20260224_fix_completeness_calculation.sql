-- ============================================================================
-- FIX GYM COMPLETENESS CALCULATION
-- 1. Makes the functions SECURITY DEFINER to bypass RLS during calculation
-- 2. Updates the point system to include Facilities and be more robust
-- 3. Ensures the onboarding status row exists
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_gym_completeness_score(p_gym_id UUID)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    g RECORD;
    branch_count INTEGER;
    contact_count INTEGER;
    plan_count INTEGER;
    photo_count INTEGER;
    doc_count INTEGER;
    hours_count INTEGER;
    payment_count INTEGER;
    facility_count INTEGER;
BEGIN
    -- Fetch gym with high privileges (though function is security definer anyway)
    SELECT * INTO g FROM public.gyms WHERE id = p_gym_id;
    IF NOT FOUND THEN RETURN 0; END IF;

    -- 1. Identity & City (10pts)
    -- Needs name and city (city is synced from primary branch in Step 2)
    IF g.name IS NOT NULL AND g.city IS NOT NULL THEN
        score := score + 10;
    END IF;

    -- 2. Primary Contact (10pts)
    SELECT COUNT(*) INTO contact_count FROM public.gym_contacts WHERE gym_id = p_gym_id;
    IF contact_count > 0 THEN score := score + 10; END IF;

    -- 3. Branch setup (10pts)
    SELECT COUNT(*) INTO branch_count FROM public.gym_branches WHERE gym_id = p_gym_id;
    IF branch_count > 0 THEN score := score + 10; END IF;

    -- 4. Facilities & Equipment (10pts)
    SELECT COUNT(*) INTO facility_count FROM public.gym_facilities_equipment WHERE gym_id = p_gym_id;
    IF facility_count > 0 THEN score := score + 10; END IF;

    -- 5. Membership plans (15pts)
    SELECT COUNT(*) INTO plan_count FROM public.gym_membership_plans WHERE gym_id = p_gym_id AND is_active = true;
    IF plan_count > 0 THEN score := score + 15; END IF;

    -- 6. Operating Hours (10pts)
    -- Expecting at least 5 days defined
    SELECT COUNT(*) INTO hours_count FROM public.gym_hours WHERE gym_id = p_gym_id;
    IF hours_count >= 5 THEN score := score + 10; END IF;

    -- 7. Media Photos (10pts)
    SELECT COUNT(*) INTO photo_count FROM public.gym_media_assets WHERE gym_id = p_gym_id;
    IF photo_count >= 3 THEN score := score + 10; END IF;

    -- 8. Payment Methods (10pts)
    SELECT COUNT(*) INTO payment_count FROM public.gym_payment_methods WHERE gym_id = p_gym_id AND is_active = true;
    IF payment_count > 0 THEN score := score + 10; END IF;

    -- 9. Verification Documents (15pts)
    SELECT COUNT(*) INTO doc_count FROM public.gym_verification_documents WHERE gym_id = p_gym_id;
    IF doc_count > 0 THEN score := score + 15; END IF;

    RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.refresh_gym_completeness_score(p_gym_id UUID)
RETURNS void AS $$
DECLARE
    new_score INTEGER;
BEGIN
    -- Calculate newer score
    new_score := public.compute_gym_completeness_score(p_gym_id);
    
    -- Ensure the status row exists first
    INSERT INTO public.gym_onboarding_status (gym_id, status, completeness_score)
    VALUES (p_gym_id, 'draft', new_score)
    ON CONFLICT (gym_id) DO UPDATE
    SET completeness_score = new_score, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill all existing gyms to fix any 0% issues immediately
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.gyms LOOP
        PERFORM public.refresh_gym_completeness_score(r.id);
    END LOOP;
END $$;

-- Reload schema
NOTIFY pgrst, 'reload schema';
