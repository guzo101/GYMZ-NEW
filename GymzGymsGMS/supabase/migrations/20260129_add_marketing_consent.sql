-- Add marketing consent field to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false;

-- Add timestamp for when consent was given
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS marketing_consent_date TIMESTAMPTZ;

-- Create index for efficient campaign querying
CREATE INDEX IF NOT EXISTS idx_users_marketing_consent 
ON users(marketing_consent) WHERE marketing_consent = true;

-- Comment for documentation
COMMENT ON COLUMN users.marketing_consent IS 'User consent to receive marketing communications (promotions, discounts, offers)';
COMMENT ON COLUMN users.marketing_consent_date IS 'Timestamp when marketing consent was granted';
