-- Migration: Add thread_id column to users table
-- thread_id is a permanent identifier for each user's AI conversation thread

-- Step 1: Add the thread_id column (nullable initially for existing users)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS thread_id TEXT;

-- Step 2: Create a unique index on thread_id (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS users_thread_id_idx 
ON users(thread_id) 
WHERE thread_id IS NOT NULL;

-- Step 3: Add a comment to document the column
COMMENT ON COLUMN users.thread_id IS 'Permanent thread identifier for AI conversations. Generated once per user and never changes. Used for long-term AI context.';

-- Note: Existing users will have NULL thread_id until they are updated
-- The application should generate thread_id when users are created or on first AI chat interaction





