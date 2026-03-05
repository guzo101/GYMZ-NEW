-- Migration: Add User Preference and Tracking Columns
-- Supports expanded AI action capabilities

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS height DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS target_weight DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS workout_intensity VARCHAR(20) DEFAULT 'moderate',
ADD COLUMN IF NOT EXISTS workout_focus VARCHAR(50),
ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[],
ADD COLUMN IF NOT EXISTS notification_frequency VARCHAR(20) DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS privacy_mode BOOLEAN DEFAULT FALSE;

-- Comments for documentation
COMMENT ON COLUMN users.height IS 'User height in cm';
COMMENT ON COLUMN users.target_weight IS 'Target weight in kg';
COMMENT ON COLUMN users.workout_intensity IS 'low, moderate, high, or extreme';
COMMENT ON COLUMN users.workout_focus IS 'e.g., cardio, strength, flexibility, hybrid';
COMMENT ON COLUMN users.dietary_restrictions IS 'Array of dietary restrictions (vegetarian, vegan, etc.)';
COMMENT ON COLUMN users.notification_frequency IS 'low, normal, or high';
COMMENT ON COLUMN users.privacy_mode IS 'Hide stats from community features';
