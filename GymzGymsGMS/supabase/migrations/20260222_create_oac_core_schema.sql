-- ============================================================================
-- OAC CORE SCHEMA MIGRATION
-- Owner Admin Console - Core Gym Onboarding Tables
-- Date: 2026-02-22
-- ============================================================================

-- ─── 1. GYM ONBOARDING STATUS (State Machine) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_onboarding_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending_verification', 'verified', 'active', 'rejected', 'changes_requested', 'suspended')),
    completeness_score INTEGER DEFAULT 0 CHECK (completeness_score >= 0 AND completeness_score <= 100),
    rejection_reason TEXT,
    reviewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(gym_id)
);

CREATE INDEX IF NOT EXISTS idx_gym_onboarding_status ON public.gym_onboarding_status(status);
CREATE INDEX IF NOT EXISTS idx_gym_onboarding_gym_id ON public.gym_onboarding_status(gym_id);

-- ─── 2. GYM BRANCHES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    branch_name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    lat NUMERIC(10, 7),
    lng NUMERIC(10, 7),
    google_maps_url TEXT,
    directions_text TEXT,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(gym_id, branch_name)
);

CREATE INDEX IF NOT EXISTS idx_gym_branches_gym_id ON public.gym_branches(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_branches_city ON public.gym_branches(city);
CREATE INDEX IF NOT EXISTS idx_gym_branches_active ON public.gym_branches(is_active);

-- ─── 3. GYM CONTACTS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    contact_type TEXT NOT NULL DEFAULT 'primary'
        CHECK (contact_type IN ('primary', 'support', 'billing', 'emergency')),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT NOT NULL,
    whatsapp TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gym_contacts_gym_id ON public.gym_contacts(gym_id);

-- ─── 4. GYM VERIFICATION DOCUMENTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_verification_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL
        CHECK (document_type IN ('business_registration', 'lease_agreement', 'utility_bill', 'owner_id', 'other')),
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL, -- Supabase Storage path (oac-documents bucket)
    file_size_bytes BIGINT,
    mime_type TEXT,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    verification_status TEXT DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'approved', 'rejected')),
    reviewer_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gym_docs_gym_id ON public.gym_verification_documents(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_docs_status ON public.gym_verification_documents(verification_status);

-- ─── 5. GYM OPERATING HOURS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.gym_branches(id) ON DELETE CASCADE,
    day_type TEXT NOT NULL
        CHECK (day_type IN ('weekday_mon', 'weekday_tue', 'weekday_wed', 'weekday_thu', 'weekday_fri', 'saturday', 'sunday', 'holiday', 'women_only')),
    is_closed BOOLEAN DEFAULT false,
    open_time TIME,
    close_time TIME,
    notes TEXT,
    UNIQUE(gym_id, branch_id, day_type)
);

CREATE INDEX IF NOT EXISTS idx_gym_hours_gym_id ON public.gym_hours(gym_id);

-- ─── 6. GYM MEDIA ASSETS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gym_media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.gym_branches(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL
        CHECK (asset_type IN ('entrance', 'reception', 'main_floor', 'cardio', 'free_weights', 'machines', 'changing_rooms', 'bathrooms', 'class_room', 'exterior', 'logo', 'other')),
    storage_path TEXT NOT NULL, -- Supabase Storage path (oac-media bucket)
    public_url TEXT,
    file_name TEXT,
    file_size_bytes BIGINT,
    mime_type TEXT,
    display_order INTEGER DEFAULT 0,
    caption TEXT,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gym_media_gym_id ON public.gym_media_assets(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_media_type ON public.gym_media_assets(asset_type);

-- ─── 7. ADMIN AUDIT LOGS ────────────────────────────────────────────────────
-- The table was previously created in an older migration, so we ALTER it here.
ALTER TABLE public.admin_audit_logs
    ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS actor_email TEXT,
    ADD COLUMN IF NOT EXISTS action TEXT,
    ADD COLUMN IF NOT EXISTS entity_type TEXT,
    ADD COLUMN IF NOT EXISTS entity_id UUID,
    ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS old_value JSONB,
    ADD COLUMN IF NOT EXISTS new_value JSONB,
    ADD COLUMN IF NOT EXISTS reason TEXT;


CREATE INDEX IF NOT EXISTS idx_audit_logs_gym_id ON public.admin_audit_logs(gym_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.admin_audit_logs(created_at DESC);

-- ─── 8. EXTEND GYMS TABLE ─────────────────────────────────────────────────
-- Add OAC-specific columns to the existing gyms table
ALTER TABLE public.gyms
    ADD COLUMN IF NOT EXISTS brand_name TEXT,
    ADD COLUMN IF NOT EXISTS legal_name TEXT,
    ADD COLUMN IF NOT EXISTS short_description TEXT,
    ADD COLUMN IF NOT EXISTS website_url TEXT,
    ADD COLUMN IF NOT EXISTS facebook_url TEXT,
    ADD COLUMN IF NOT EXISTS instagram_url TEXT,
    ADD COLUMN IF NOT EXISTS tiktok_url TEXT,
    ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
    ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS lng NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Zambia',
    ADD COLUMN IF NOT EXISTS search_radius_km INTEGER DEFAULT 10,
    ADD COLUMN IF NOT EXISTS best_for_tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS vibe_tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS peak_hours_note TEXT,
    ADD COLUMN IF NOT EXISTS minimum_age INTEGER DEFAULT 16,
    ADD COLUMN IF NOT EXISTS guest_policy TEXT,
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ZMW',
    ADD COLUMN IF NOT EXISTS joining_fee NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cancellation_policy TEXT,
    ADD COLUMN IF NOT EXISTS gym_rules TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS staffed_hours TEXT,
    ADD COLUMN IF NOT EXISTS has_security_cameras BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_security_guard BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_access_control BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_first_aid BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS cleaning_schedule TEXT,
    ADD COLUMN IF NOT EXISTS check_in_method TEXT DEFAULT 'qr'
        CHECK (check_in_method IN ('qr', 'member_id', 'front_desk', 'biometric')),
    ADD COLUMN IF NOT EXISTS membership_validation TEXT DEFAULT 'manual'
        CHECK (membership_validation IN ('manual', 'auto_after_payment')),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_gyms_city ON public.gyms(city);
CREATE INDEX IF NOT EXISTS idx_gyms_status ON public.gyms(status);

-- Trigger to auto-update updated_at on gyms
CREATE OR REPLACE FUNCTION update_gyms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gyms_updated_at ON public.gyms;
CREATE TRIGGER trg_gyms_updated_at
    BEFORE UPDATE ON public.gyms
    FOR EACH ROW EXECUTE FUNCTION update_gyms_updated_at();

-- Auto-provision onboarding status when a gym is created
CREATE OR REPLACE FUNCTION provision_gym_onboarding_status()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.gym_onboarding_status (gym_id, status, completeness_score)
    VALUES (NEW.id, 'draft', 0)
    ON CONFLICT (gym_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_provision_gym_onboarding ON public.gyms;
CREATE TRIGGER trg_provision_gym_onboarding
    AFTER INSERT ON public.gyms
    FOR EACH ROW EXECUTE FUNCTION provision_gym_onboarding_status();

-- Reload Supabase schema cache
NOTIFY pgrst, 'reload schema';
