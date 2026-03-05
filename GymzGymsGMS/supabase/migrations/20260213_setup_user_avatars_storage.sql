-- STORAGE BUCKET SETUP FOR USER AVATARS
-- This migration creates the user-avatars bucket if it doesn't exist
-- and sets up the necessary RLS policies for both GMS and App access

BEGIN;

-- 1. Create the user-avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT 
    'user-avatars', 
    'user-avatars', 
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'user-avatars'
);

-- 2. DROP ALL existing policies to ensure clean slate
DROP POLICY IF EXISTS "Allow authenticated uploads to user-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to user-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from user-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to user-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

-- 3. CREATE POLICIES: Allow authenticated users to upload/update/delete their own avatars
CREATE POLICY "Authenticated users can upload avatars" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (
    bucket_id = 'user-avatars'
);

CREATE POLICY "Users can update own avatars" 
ON storage.objects 
FOR UPDATE 
TO authenticated 
USING (
    bucket_id = 'user-avatars'
);

CREATE POLICY "Users can delete own avatars" 
ON storage.objects 
FOR DELETE 
TO authenticated 
USING (
    bucket_id = 'user-avatars'
);

-- 4. CREATE POLICY: Allow public read access (so avatars can be displayed)
CREATE POLICY "Public can view avatars" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'user-avatars');

COMMIT;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
