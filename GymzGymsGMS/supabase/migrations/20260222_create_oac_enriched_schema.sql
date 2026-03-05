-- ============================================================================
-- OAC ENRICHED SCHEMA MIGRATION
-- Owner Admin Console - Gym Profile Enrichment Tables
-- Date: 2026-02-22
-- ============================================================================

-- ─── 1. GYM MEMBERSHIP PLANS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    plan_type TEXT NOT NULL
        CHECK (plan_type IN ('daily', 'weekly', 'monthly', '3_months', '6_months', 'annual', 'custom')),
    plan_name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    currency TEXT DEFAULT 'ZMW',
    duration_days INTEGER,
    includes_classes BOOLEAN DEFAULT false,
    includes_trainer BOOLEAN DEFAULT false,
    access_hours_note TEXT, -- "24/7" or "6am-10pm"
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gym_plans_gym_id ON public.gym_membership_plans(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_plans_active ON public.gym_membership_plans(is_active);

-- ─── 2. GYM PROMOTIONS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    discount_type TEXT DEFAULT 'percentage'
        CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_days')),
    discount_value NUMERIC(10, 2) NOT NULL,
    applies_to_plan_id UUID REFERENCES public.gym_membership_plans(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gym_promos_gym_id ON public.gym_promotions(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_promos_dates ON public.gym_promotions(start_date, end_date);

-- ─── 3. GYM FACILITIES & EQUIPMENT ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_facilities_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.gym_branches(id) ON DELETE CASCADE,
    category TEXT NOT NULL
        CHECK (category IN ('cardio', 'strength', 'machines', 'functional', 'extras', 'amenity')),
    item_name TEXT NOT NULL,
    item_count INTEGER DEFAULT 1,
    is_available BOOLEAN DEFAULT true,
    notes TEXT,
    UNIQUE(gym_id, branch_id, item_name)
);

CREATE INDEX IF NOT EXISTS idx_gym_facilities_gym_id ON public.gym_facilities_equipment(gym_id);

-- ─── 4. GYM TRAINERS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_trainers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.gym_branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'trainer',
    specialties TEXT[] DEFAULT '{}',
    bio TEXT,
    is_certified BOOLEAN DEFAULT false,
    cert_document_path TEXT, -- Supabase Storage path
    session_price_zmw NUMERIC(10,2),
    package_price_zmw NUMERIC(10,2),
    package_sessions INTEGER,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gym_trainers_gym_id ON public.gym_trainers(gym_id);

-- ─── 5. GYM CLASSES ────────────────────────────────────────────────────────
-- This table already exists from create_gym_calendar_tables.sql, so we ALTER it here.
ALTER TABLE public.gym_classes
    ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.gym_branches(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS class_type TEXT,
    ADD COLUMN IF NOT EXISTS capacity INTEGER,
    ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'included',
    ADD COLUMN IF NOT EXISTS price_zmw NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS requires_booking BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Ensure gym_id is required going forward
-- Note: if there is legacy data without gym_id, this may fail. If so, manual intervention is needed.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'gym_classes' 
        AND column_name = 'gym_id' 
        AND is_nullable = 'NO'
    ) THEN
        -- We won't alter to NOT NULL immediately to avoid breaking existing data
        -- But it's highly recommended for new records
        RAISE NOTICE 'gym_classes.gym_id added, but left nullable to support legacy data. Please backfill and enforce NOT NULL later.';
    END IF;
END $$;


CREATE INDEX IF NOT EXISTS idx_gym_classes_gym_id ON public.gym_classes(gym_id);

-- ─── 6. GYM CLASS SCHEDULES ─────────────────────────────────────────────────
-- This table also exists from create_gym_calendar_tables.sql
ALTER TABLE public.gym_class_schedules
    ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS day_of_week TEXT 
        CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
    ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;

-- We cannot easily add UNIQUE(class_id, day_of_week, start_time) if there is existing data without day_of_week
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_gym_class_schedules'
    ) THEN
        -- Only add the constraint if we're sure day_of_week is populated, or just leave it for application logic
        -- To be safe, we won't strictly enforce it at the DB level yet to prevent migration crashes on existing data
        RAISE NOTICE 'Skipping UNIQUE(class_id, day_of_week, start_time) to avoid breaking existing schedule data.';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gym_schedules_class_id ON public.gym_class_schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_gym_schedules_gym_id ON public.gym_class_schedules(gym_id);

-- ─── 7. GYM PAYMENT METHODS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    method TEXT NOT NULL
        CHECK (method IN ('cash', 'mobile_money', 'card', 'bank_transfer', 'crypto', 'other')),
    provider_name TEXT, -- e.g. "Airtel Money", "Zamtel Kwacha"
    account_number TEXT,
    instructions TEXT,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(gym_id, method, provider_name)
);

CREATE INDEX IF NOT EXISTS idx_gym_payment_methods_gym_id ON public.gym_payment_methods(gym_id);

-- ─── 8. GYM RECEIPT RULES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_receipt_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    requires_member_name BOOLEAN DEFAULT true,
    requires_branch_name BOOLEAN DEFAULT true,
    requires_date BOOLEAN DEFAULT true,
    requires_amount BOOLEAN DEFAULT true,
    requires_period_covered BOOLEAN DEFAULT true,
    requires_member_gym_id BOOLEAN DEFAULT true,
    custom_footer_text TEXT,
    logo_storage_path TEXT,
    UNIQUE(gym_id)
);

-- ─── 9. GYM DISCOVERY SETTINGS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_discovery_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    is_discoverable BOOLEAN DEFAULT true,
    search_radius_km INTEGER DEFAULT 10,
    google_maps_link TEXT,
    testimonials JSONB DEFAULT '[]'::jsonb, -- [{author, text, rating}]
    imported_rating_summary JSONB, -- {source: "Google", rating: 4.5, count: 102}
    nearby_landmarks TEXT,
    parking_notes TEXT,
    access_notes TEXT,
    UNIQUE(gym_id)
);

-- ─── 10. COMPLETENESS SCORE FUNCTION ────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_gym_completeness_score(p_gym_id UUID)
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
BEGIN
    SELECT * INTO g FROM public.gyms WHERE id = p_gym_id;
    IF NOT FOUND THEN RETURN 0; END IF;

    -- Location + City (10pts)
    IF g.lat IS NOT NULL AND g.lng IS NOT NULL AND g.city IS NOT NULL THEN
        score := score + 10;
    END IF;

    -- Branch setup (10pts)
    SELECT COUNT(*) INTO branch_count FROM public.gym_branches WHERE gym_id = p_gym_id;
    IF branch_count > 0 THEN score := score + 10; END IF;

    -- Contacts (10pts)
    SELECT COUNT(*) INTO contact_count FROM public.gym_contacts WHERE gym_id = p_gym_id;
    IF contact_count > 0 THEN score := score + 10; END IF;

    -- Pricing plans (15pts)
    SELECT COUNT(*) INTO plan_count FROM public.gym_membership_plans WHERE gym_id = p_gym_id AND is_active = true;
    IF plan_count > 0 THEN score := score + 15; END IF;

    -- Hours set (10pts)
    SELECT COUNT(*) INTO hours_count FROM public.gym_hours WHERE gym_id = p_gym_id;
    IF hours_count >= 5 THEN score := score + 10; END IF;

    -- Photos (15pts)
    SELECT COUNT(*) INTO photo_count FROM public.gym_media_assets WHERE gym_id = p_gym_id;
    IF photo_count >= 3 THEN score := score + 15; END IF;

    -- Verification document (20pts)
    SELECT COUNT(*) INTO doc_count FROM public.gym_verification_documents WHERE gym_id = p_gym_id;
    IF doc_count > 0 THEN score := score + 20; END IF;

    -- Payment method (10pts)
    SELECT COUNT(*) INTO payment_count FROM public.gym_payment_methods WHERE gym_id = p_gym_id AND is_active = true;
    IF payment_count > 0 THEN score := score + 10; END IF;

    RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql;

-- Function to refresh completeness score on gym_onboarding_status
CREATE OR REPLACE FUNCTION refresh_gym_completeness_score(p_gym_id UUID)
RETURNS void AS $$
DECLARE
    new_score INTEGER;
BEGIN
    new_score := compute_gym_completeness_score(p_gym_id);
    UPDATE public.gym_onboarding_status
    SET completeness_score = new_score, updated_at = NOW()
    WHERE gym_id = p_gym_id;
END;
$$ LANGUAGE plpgsql;

-- Reload schema
NOTIFY pgrst, 'reload schema';
