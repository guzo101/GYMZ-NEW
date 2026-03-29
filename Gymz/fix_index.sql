-- 1. Drop existing index if it exists (it might be corrupted or missing)
DROP INDEX IF EXISTS public.idx_user_fitness_goals_user_active_unique;

-- 2. Drop duplicates (in case that's why the index failed to build previously)
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER(
           PARTITION BY user_id 
           ORDER BY updated_at DESC
         ) as row_num
  FROM public.user_fitness_goals
  WHERE is_active = TRUE
)
DELETE FROM public.user_fitness_goals
WHERE id IN (
  SELECT id FROM duplicates WHERE row_num > 1
);

-- 3. Recreate the precise index expected by the ON CONFLICT clause
CREATE UNIQUE INDEX idx_user_fitness_goals_user_active_unique 
ON public.user_fitness_goals (user_id) 
WHERE is_active = TRUE;
