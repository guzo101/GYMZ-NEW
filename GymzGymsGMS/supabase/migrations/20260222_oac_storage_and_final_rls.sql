-- ============================================================================
-- OAC STORAGE BUCKETS + FINAL SETUP
-- Creates the Supabase Storage buckets required by OAC file upload steps
-- Run this in the Supabase SQL Editor for the Gymz project
-- ============================================================================

-- ─── 1. Storage Buckets ───────────────────────────────────────────────────────
-- Create oac-media bucket for gym photos (Step 6)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'oac-media',
    'oac-media',
    true,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- Create oac-documents bucket for verification documents (Step 8)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'oac-documents',
    'oac-documents',
    false, -- Private, accessible via signed URLs only
    10485760, -- 10MB
    ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
) ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

-- ─── 2. Storage RLS Policies ──────────────────────────────────────────────────

-- oac-media: Platform admins can upload, public can read
DROP POLICY IF EXISTS "Platform admins upload gym media" ON storage.objects;
CREATE POLICY "Platform admins upload gym media"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'oac-media'
    AND public.is_platform_admin()
);

DROP POLICY IF EXISTS "Platform admins delete gym media" ON storage.objects;
CREATE POLICY "Platform admins delete gym media"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'oac-media'
    AND public.is_platform_admin()
);

DROP POLICY IF EXISTS "Anyone can view gym media" ON storage.objects;
CREATE POLICY "Anyone can view gym media"
ON storage.objects FOR SELECT
USING (bucket_id = 'oac-media');

-- oac-documents: Only platform admins can upload and view
DROP POLICY IF EXISTS "Platform admins upload verification docs" ON storage.objects;
CREATE POLICY "Platform admins upload verification docs"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'oac-documents'
    AND public.is_platform_admin()
);

DROP POLICY IF EXISTS "Platform admins view verification docs" ON storage.objects;
CREATE POLICY "Platform admins view verification docs"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'oac-documents'
    AND public.is_platform_admin()
);

DROP POLICY IF EXISTS "Platform admins delete verification docs" ON storage.objects;
CREATE POLICY "Platform admins delete verification docs"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'oac-documents'
    AND public.is_platform_admin()
);

-- ─── 3. Ensure gyms RLS allows platform admins full access ──────────────────
-- The gyms table may have its own RLS that blocks OAC reads
DROP POLICY IF EXISTS "Platform admins have full access to gyms" ON public.gyms;
CREATE POLICY "Platform admins have full access to gyms"
ON public.gyms FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- ─── 4. Create gym_applications if it doesn't exist, then fix RLS ─────────
CREATE TABLE IF NOT EXISTS public.gym_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gym_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    feature_flags JSONB DEFAULT '{"events_enabled": true, "sponsors_enabled": true}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gym_applications ENABLE ROW LEVEL SECURITY;

-- Allow public submissions (from GOS form)
DROP POLICY IF EXISTS "Anyone can submit a gym application" ON public.gym_applications;
CREATE POLICY "Anyone can submit a gym application"
ON public.gym_applications FOR INSERT
WITH CHECK (true);

-- Platform admins can view all applications
DROP POLICY IF EXISTS "Platform admins can view applications" ON public.gym_applications;
CREATE POLICY "Platform admins can view applications"
ON public.gym_applications FOR SELECT
USING (public.is_platform_admin());

-- Platform admins can update (approve/reject)
DROP POLICY IF EXISTS "Platform admins can update applications" ON public.gym_applications;
CREATE POLICY "Platform admins can update applications"
ON public.gym_applications FOR UPDATE
USING (public.is_platform_admin());

-- provision_new_gym function (creates gym from application data)
CREATE OR REPLACE FUNCTION public.provision_new_gym(
    p_gym_name TEXT,
    p_owner_email TEXT,
    p_owner_name TEXT,
    p_location TEXT,
    p_feature_flags JSONB
) RETURNS UUID AS $$
DECLARE
    new_gym_id UUID;
BEGIN
    INSERT INTO public.gyms (
        name,
        location,
        status,
        subscription_plan,
        events_enabled,
        sponsors_enabled
    ) VALUES (
        p_gym_name,
        p_location,
        'active',
        'pro',
        COALESCE((p_feature_flags->>'events_enabled')::boolean, true),
        COALESCE((p_feature_flags->>'sponsors_enabled')::boolean, true)
    ) RETURNING id INTO new_gym_id;

    RETURN new_gym_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. Ensure backfill of gym_onboarding_status for existing gyms ──────────
INSERT INTO public.gym_onboarding_status (gym_id, status, completeness_score)
SELECT id, 'draft', 0 FROM public.gyms g
WHERE NOT EXISTS (
    SELECT 1 FROM public.gym_onboarding_status s WHERE s.gym_id = g.id
) ON CONFLICT (gym_id) DO NOTHING;

-- ─── 6. Reload schema cache ──────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
