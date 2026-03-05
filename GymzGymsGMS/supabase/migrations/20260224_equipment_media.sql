-- ============================================================================
-- EQUIPMENT MEDIA MIGRATION
-- Adds support for images on individual equipment items.
-- ============================================================================

-- 1. Create the new table for equipment media
CREATE TABLE IF NOT EXISTS public.gym_equipment_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES public.gym_facilities_equipment(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by equipment
CREATE INDEX IF NOT EXISTS idx_gym_equipment_media_eq_id ON public.gym_equipment_media(equipment_id);

-- 2. Setup storage bucket
-- Note: We do this manually via INSERT because storage schema is handled by extensions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'equipment-media',
    'equipment-media',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 3. RLS Policies for the new table
ALTER TABLE public.gym_equipment_media ENABLE ROW LEVEL SECURITY;

-- Platform admins: Full access
DROP POLICY IF EXISTS "Platform admins manage equipment media" ON public.gym_equipment_media;
CREATE POLICY "Platform admins manage equipment media"
ON public.gym_equipment_media FOR ALL
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- Gym owners: Manage their own equipment media
DROP POLICY IF EXISTS "Gym owners manage their equipment media" ON public.gym_equipment_media;
CREATE POLICY "Gym owners manage their equipment media"
ON public.gym_equipment_media FOR ALL
USING (
    equipment_id IN (
        SELECT id FROM public.gym_facilities_equipment
        WHERE gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid())
    )
)
WITH CHECK (
    equipment_id IN (
        SELECT id FROM public.gym_facilities_equipment
        WHERE gym_id IN (SELECT gym_id FROM public.users WHERE id = auth.uid())
    )
);

-- Public: Select access
DROP POLICY IF EXISTS "Public can view equipment media" ON public.gym_equipment_media;
CREATE POLICY "Public can view equipment media"
ON public.gym_equipment_media FOR SELECT
USING (true);

-- 4. Storage Policies for equipment-media bucket
DROP POLICY IF EXISTS "Platform admins upload equipment media" ON storage.objects;
CREATE POLICY "Platform admins upload equipment media"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'equipment-media'
    AND public.is_platform_admin()
);

DROP POLICY IF EXISTS "Gym owners upload equipment media" ON storage.objects;
CREATE POLICY "Gym owners upload equipment media"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'equipment-media'
    AND (EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'owner'
    ))
);

DROP POLICY IF EXISTS "Platform admins delete equipment media" ON storage.objects;
CREATE POLICY "Platform admins delete equipment media"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'equipment-media'
    AND public.is_platform_admin()
);

DROP POLICY IF EXISTS "Gym owners delete equipment media" ON storage.objects;
CREATE POLICY "Gym owners delete equipment media"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'equipment-media'
    AND (EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'owner'
    ))
);

DROP POLICY IF EXISTS "Anyone can view equipment media" ON storage.objects;
CREATE POLICY "Anyone can view equipment media"
ON storage.objects FOR SELECT
USING (bucket_id = 'equipment-media');

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
