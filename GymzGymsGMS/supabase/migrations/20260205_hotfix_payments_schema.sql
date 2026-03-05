-- ================================================================================
-- HOTFIX: ADD UPDATED_AT TO PAYMENTS
-- Required for activation logic and general auditing
-- ================================================================================

BEGIN;

-- 1. Add updated_at to payments if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added updated_at column to payments table';
  END IF;
END $$;

-- 2. Add triggering for updated_at if function exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payments_updated_at') THEN
            CREATE TRIGGER trg_payments_updated_at
            BEFORE UPDATE ON public.payments
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
        END IF;
    END IF;
END $$;

COMMIT;
