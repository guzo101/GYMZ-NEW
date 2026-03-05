-- Create pending_outreach table for AI-powered autonomous messaging
CREATE TABLE IF NOT EXISTS pending_outreach (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'renewal', 'win_back', 'streak_broken', etc.
    status TEXT NOT NULL DEFAULT 'drafted', -- 'drafted', 'sent', 'cancelled', 'obsolete'
    metadata JSONB DEFAULT '{}'::jsonb,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_outreach_user_id ON pending_outreach(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_outreach_status ON pending_outreach(status);
CREATE INDEX IF NOT EXISTS idx_pending_outreach_scheduled_for ON pending_outreach(scheduled_for);

-- Add RLS policies for security (Admin only)
ALTER TABLE pending_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on pending_outreach"
    ON pending_outreach
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pending_outreach_updated_at
    BEFORE UPDATE ON pending_outreach
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
