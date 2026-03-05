-- Gymz Neural Engine: User Snapshots & Progress Photos
-- Purpose: Create table and storage infrastructure for progress photo tracking.

BEGIN;

-- 1. Create user_snapshots table
CREATE TABLE IF NOT EXISTS public.user_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    weight NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by user and date
CREATE INDEX IF NOT EXISTS idx_user_snapshots_user_date ON public.user_snapshots(user_id, date DESC);

-- Enable RLS
ALTER TABLE public.user_snapshots ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies
DROP POLICY IF EXISTS "Users can view own snapshots" ON public.user_snapshots;
CREATE POLICY "Users can view own snapshots" ON public.user_snapshots 
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own snapshots" ON public.user_snapshots;
CREATE POLICY "Users can insert own snapshots" ON public.user_snapshots 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own snapshots" ON public.user_snapshots;
CREATE POLICY "Users can delete own snapshots" ON public.user_snapshots 
    FOR DELETE USING (auth.uid() = user_id);

-- 3. Storage Bucket Setup
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 
    'user-snapshots', 
    'user-snapshots', 
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'user-snapshots'
);

-- Storage Policies
-- We use unique names to avoid conflicts with other storage migrations
DROP POLICY IF EXISTS "Authenticated users can upload snapshots" ON storage.objects;
CREATE POLICY "Authenticated users can upload snapshots" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'user-snapshots');

DROP POLICY IF EXISTS "Users can update own snapshots" ON storage.objects;
CREATE POLICY "Users can update own snapshots" 
ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id = 'user-snapshots');

DROP POLICY IF EXISTS "Users can delete own snapshots" ON storage.objects;
CREATE POLICY "Users can delete own snapshots" 
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'user-snapshots');

DROP POLICY IF EXISTS "Public can view snapshots" ON storage.objects;
CREATE POLICY "Public can view snapshots" 
ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'user-snapshots');

COMMIT;

-- Reload schema
NOTIFY pgrst, 'reload schema';
