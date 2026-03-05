-- Migration: Add additional columns to payments table for Zambia payment methods
-- This migration adds columns for mobile money, bank transfer, and cash payment details

-- Add user_id column if it doesn't exist (for linking payments to users)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN user_id UUID REFERENCES users(id);
  END IF;
END $$;

-- Add transaction_reference column for mobile money and bank transfers
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'transaction_reference'
  ) THEN
    ALTER TABLE payments ADD COLUMN transaction_reference TEXT;
  END IF;
END $$;

-- Add mobile_number column for mobile money payments
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'mobile_number'
  ) THEN
    ALTER TABLE payments ADD COLUMN mobile_number TEXT;
  END IF;
END $$;

-- Add bank_name column for bank transfer payments
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'bank_name'
  ) THEN
    ALTER TABLE payments ADD COLUMN bank_name TEXT;
  END IF;
END $$;

-- Add account_number column for bank transfer payments
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'account_number'
  ) THEN
    ALTER TABLE payments ADD COLUMN account_number TEXT;
  END IF;
END $$;

-- Add created_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Add tip_amount column for trainer tips
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'tip_amount'
  ) THEN
    ALTER TABLE payments ADD COLUMN tip_amount NUMERIC(15, 2);
  ELSE
    -- If column exists but is too small, alter it to be larger
    ALTER TABLE payments ALTER COLUMN tip_amount TYPE NUMERIC(15, 2);
  END IF;
END $$;

-- Add trainer_id column to link tips to trainers
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'trainer_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN trainer_id UUID REFERENCES staff(id);
  END IF;
END $$;

-- Add months column for subscription duration
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'months'
  ) THEN
    ALTER TABLE payments ADD COLUMN months INTEGER DEFAULT 1;
  END IF;
END $$;

-- Add payment_id column to notifications table to link notifications to payments
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'payment_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN payment_id UUID REFERENCES payments(id);
  END IF;
END $$;

-- Add approved_by column to track which admin approved the payment
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE payments ADD COLUMN approved_by UUID REFERENCES users(id);
  END IF;
END $$;

-- Add approved_at column to track when the payment was approved
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Update status column to support 'pending_approval' status for cash payments
-- Note: This assumes status is a TEXT/VARCHAR column. Adjust if using an enum.
-- The application will handle the 'pending_approval' status value.

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Create index on created_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

