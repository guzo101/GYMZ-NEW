-- ============================================================================
-- METADATA RECOVERY (DEFINITIVE TYPE-SAFE VERSION)
-- Purpose: Sync "trapped" data from JSON metadata to the actual user profile.
-- Handles mixed types: Age (Integer), Weight (Numeric), Height (Text).
-- ============================================================================

BEGIN;

-- 1. SYNC: Pull metrics out of the JSON metadata "Pocket"
-- We use NULLIF and explicit casting to match each column's specific type.
UPDATE public.users
SET 
    -- Age is an INTEGER
    age = COALESCE(age, (NULLIF(metadata->>'age', ''))::INTEGER),
    
    -- Weight is a NUMERIC
    weight = COALESCE(weight, (NULLIF(metadata->>'weight', ''))::NUMERIC),
    
    -- Height is TEXT (Legacy format)
    height = COALESCE(height, metadata->>'height'),
    
    -- Gender and Goal are TEXT
    gender = COALESCE(gender, metadata->>'gender'),
    goal = COALESCE(goal, metadata->>'fitnessGoal')
WHERE (metadata IS NOT NULL)
  AND (age IS NULL OR gender IS NULL OR weight IS NULL OR height IS NULL);

-- 2. ACTIVATE: Force the Medical Engine to recalculate
UPDATE public.users 
SET updated_at = NOW() 
WHERE weight IS NOT NULL 
  AND height IS NOT NULL 
  AND age IS NOT NULL;

COMMIT;

-- Reload Schema for the Dashboard mapping
NOTIFY pgrst, 'reload schema';
