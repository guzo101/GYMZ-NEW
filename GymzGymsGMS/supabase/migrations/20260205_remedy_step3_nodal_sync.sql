-- ================================================================================
-- REMEDY STEP 3: Nodal Model Synchronization & Integrity
-- ================================================================================

BEGIN;

-- 1. ADD MISSING CONSTRAINTS (DEFENSIVE)
-- Hardens the database against orphaned records and invalid data.

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payments') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_user') THEN
            ALTER TABLE public.payments ADD CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscriptions') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscriptions_user') THEN
            ALTER TABLE public.subscriptions ADD CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscriptions_tier') THEN
            -- Only add if membership_tiers table exists
            IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'membership_tiers') THEN
                ALTER TABLE public.subscriptions ADD CONSTRAINT fk_subscriptions_tier FOREIGN KEY (tier_id) REFERENCES public.membership_tiers(id);
            END IF;
        END IF;
    END IF;
END $$;

-- 2. NODAL SYNC FUNCTION
-- Ensures public.users fields are ALWAYS in sync with subscriptions
CREATE OR REPLACE FUNCTION public.handle_subscription_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_status_map TEXT;
BEGIN
    -- Map nodal status to legacy membership_status
    v_status_map := CASE 
        WHEN NEW.status = 'active' THEN 'Active'
        WHEN NEW.status = 'expired' THEN 'Inactive'
        WHEN NEW.status = 'grace_period' THEN 'Active'
        WHEN NEW.status = 'canceled' THEN 'Inactive'
        ELSE 'Inactive'
    END;

    -- Update legacy user fields
    UPDATE public.users 
    SET 
        membership_status = v_status_map,
        membership_expiry = NEW.ends_at::date,
        updated_at = NOW()
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CREATE SYNC TRIGGER
DROP TRIGGER IF EXISTS trg_sync_subscription_to_user ON public.subscriptions;
CREATE TRIGGER trg_sync_subscription_to_user
AFTER INSERT OR UPDATE OF status, ends_at ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.handle_subscription_sync();

-- 4. BACKFILL NODAL DATA
-- Sync users to their latest subscription status if missing
DO $$
DECLARE
    sub record;
BEGIN
    FOR sub IN (
        SELECT DISTINCT ON (user_id) * 
        FROM public.subscriptions 
        ORDER BY user_id, ends_at DESC
    ) LOOP
        UPDATE public.users SET 
            membership_status = CASE 
                WHEN sub.status = 'active' THEN 'Active'
                WHEN sub.status = 'expired' THEN 'Inactive'
                ELSE 'Inactive'
            END,
            membership_expiry = sub.ends_at::date
        WHERE id = sub.user_id;
    END LOOP;
END $$;

COMMIT;
