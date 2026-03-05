-- ============================================================
-- GYMZ PLATFORM — USER METRICS & GOAL SYNC MIGRATION
-- ============================================================

-- 1. Ensure top-level metric columns exist in users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS height             NUMERIC,
  ADD COLUMN IF NOT EXISTS weight             NUMERIC,
  ADD COLUMN IF NOT EXISTS age                INTEGER,
  ADD COLUMN IF NOT EXISTS gender             TEXT,
  ADD COLUMN IF NOT EXISTS goal               TEXT,
  ADD COLUMN IF NOT EXISTS primary_objective   TEXT,
  ADD COLUMN IF NOT EXISTS target_weight      NUMERIC,
  ADD COLUMN IF NOT EXISTS recommended_weight NUMERIC,
  ADD COLUMN IF NOT EXISTS goal_timeframe     TEXT;

-- 2. Backfill existing users from metadata JSONB field
UPDATE users
SET
  height = COALESCE(height, (metadata->>'height')::NUMERIC),
  weight = COALESCE(weight, (metadata->>'weight')::NUMERIC),
  age = COALESCE(age, (metadata->>'age')::INTEGER),
  gender = COALESCE(gender, metadata->>'gender'),
  goal = COALESCE(goal, metadata->>'fitnessGoal'),
  primary_objective = COALESCE(primary_objective, metadata->>'fitnessGoal'),
  target_weight = COALESCE(target_weight, (metadata->>'target_weight')::NUMERIC)
WHERE metadata IS NOT NULL;

-- 3. Create indices for metrics
CREATE INDEX IF NOT EXISTS idx_users_fitness_metrics ON users(id, weight, height, age);

-- 4. Notify PGRST to reload schema (for PostgREST API reflection)
NOTIFY pgrst, 'reload schema';
