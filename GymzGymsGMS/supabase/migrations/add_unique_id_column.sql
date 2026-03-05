-- Migration: Add unique_id column to users table
-- This migration adds a unique_id column to store user identification codes
-- Format: 4 digits + 1 special character (e.g., 1234@, 5678!)

-- Step 1: Add the unique_id column (nullable initially for existing users)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS unique_id TEXT;

-- Step 2: Create a unique index on unique_id (only for non-null values)
-- This ensures uniqueness while allowing NULL values for existing users
-- The WHERE clause allows multiple NULL values but enforces uniqueness for non-NULL values
CREATE UNIQUE INDEX IF NOT EXISTS users_unique_id_idx 
ON users(unique_id) 
WHERE unique_id IS NOT NULL;

-- Step 3: Add a comment to document the column
COMMENT ON COLUMN users.unique_id IS 'Unique user identification code: 4 digits + 1 special character. Used for authentication and user identification.';

-- Verify the column was added (uncomment to check):
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name = 'unique_id';

