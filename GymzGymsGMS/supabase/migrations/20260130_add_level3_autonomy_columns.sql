-- Add Level 3 Autonomy columns to pending_outreach
-- These support confidence scoring and auto-pilot features

-- Add confidence_score for AI message quality assessment
ALTER TABLE pending_outreach 
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC;

-- Add is_auto_pilot flag to track autonomous sends
ALTER TABLE pending_outreach 
ADD COLUMN IF NOT EXISTS is_auto_pilot BOOLEAN DEFAULT FALSE;

-- Add recovered_at to track when win-back members return
ALTER TABLE pending_outreach 
ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMP WITH TIME ZONE;

-- Add index for recovery tracking
CREATE INDEX IF NOT EXISTS idx_pending_outreach_recovered 
ON pending_outreach(recovered_at) WHERE recovered_at IS NULL;
