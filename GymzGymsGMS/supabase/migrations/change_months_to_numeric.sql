-- Migration: Change months column to numeric to support fractional months (e.g. 0.033 for Day Pass)

DO $$ 
BEGIN
  -- Alter payments table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'months'
  ) THEN
    ALTER TABLE payments ALTER COLUMN months TYPE NUMERIC(10, 3);
  END IF;

  -- Alter users table (if it exists there too, as seen in frontend code)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'subscription_duration_months'
  ) THEN
    ALTER TABLE users ALTER COLUMN subscription_duration_months TYPE NUMERIC(10, 3);
  END IF;
END $$;
