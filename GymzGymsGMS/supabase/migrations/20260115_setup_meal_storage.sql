-- ==========================================
-- SUPABASE STORAGE SETUP: meal-images
-- Ensures bucket exists and has correct policies
-- ==========================================

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'meal-images', 'meal-images', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'meal-images'
);

-- 2. Enable Authenticated Uploads
CREATE POLICY "Allow authenticated uploads" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'meal-images');

-- 3. Enable Authenticated Update/Delete (Optional but recommended for reliability)
CREATE POLICY "Allow authenticated updates" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'meal-images');

CREATE POLICY "Allow authenticated deletes" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'meal-images');

-- 4. Enable Public Read Access
CREATE POLICY "Allow public read access" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'meal-images');
