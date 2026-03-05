-- Audit column types and current data for the overflow user
SELECT 
    column_name, 
    data_type, 
    numeric_precision, 
    numeric_scale
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('calculated_bmi', 'calculated_bmr', 'calculated_tdee', 'weight', 'height', 'age');

-- Also check for "Wild" data that could cause calculation spikes
SELECT 
    id, email, weight, height, age, metadata
FROM public.users 
WHERE (weight IS NOT NULL AND height IS NOT NULL AND age IS NOT NULL)
ORDER BY updated_at DESC 
LIMIT 10;
