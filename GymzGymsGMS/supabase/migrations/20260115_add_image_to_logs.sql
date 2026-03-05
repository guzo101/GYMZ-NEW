-- Add image_url to daily_nutrition_logs
ALTER TABLE public.daily_nutrition_logs 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Also ensuring it's in meal_scans (already exists but just in case for consistency in future migrations)
-- ALTER TABLE public.meal_scans ADD COLUMN IF NOT EXISTS image_url TEXT; 
