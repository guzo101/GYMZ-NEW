-- Migration: Track users who continue with limited access
-- Date: 2026-01-30

-- Create table to track limited access sessions
CREATE TABLE IF NOT EXISTS limited_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    membership_status TEXT,
    action TEXT DEFAULT 'continued_with_limited_access'
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_limited_access_logs_user_id ON limited_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_limited_access_logs_accessed_at ON limited_access_logs(accessed_at DESC);

-- Enable RLS
ALTER TABLE limited_access_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own logs
CREATE POLICY "Users can insert own limited access logs"
    ON limited_access_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow admins to view all logs
CREATE POLICY "Admins can view all limited access logs"
    ON limited_access_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND u.role = 'admin'
        )
    );

-- Allow users to view their own logs
CREATE POLICY "Users can view own limited access logs"
    ON limited_access_logs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

COMMENT ON TABLE limited_access_logs IS 'Tracks when users choose to continue with limited access instead of renewing';
