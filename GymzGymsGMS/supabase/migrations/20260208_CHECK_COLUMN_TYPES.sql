-- Audit Column Types for accurate recovery
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('age', 'height', 'weight', 'gender', 'goal');
