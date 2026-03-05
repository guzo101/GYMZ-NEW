-- Migration: Create gym-images storage bucket for event and sponsor images

-- Create the public storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'gym-images',
    'gym-images',
    true,
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload to their gym folder
CREATE POLICY "Authenticated users can upload gym images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'gym-images');

-- Policy: Allow public read of all gym images
CREATE POLICY "Public can read gym images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'gym-images');

-- Policy: Allow authenticated users to update/delete their uploads
CREATE POLICY "Authenticated users can update gym images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'gym-images');

CREATE POLICY "Authenticated users can delete gym images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'gym-images');
