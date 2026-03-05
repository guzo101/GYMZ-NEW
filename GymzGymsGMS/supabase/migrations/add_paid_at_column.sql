-- Migration: Add paid_at column to payments table
-- This column tracks when the payment was actually made (in UTC+2 timezone, stored as UTC)

-- Add paid_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN paid_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create index on paid_at for faster queries and sorting
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);

