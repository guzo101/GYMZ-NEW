-- Trigger to automatically set user membership_status to 'Pending' when they submit a payment
CREATE OR REPLACE FUNCTION public.sync_membership_status_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run when a PENDING payment is inserted or updated
    IF NEW.status = 'pending' THEN
        UPDATE public.users
        SET 
            membership_status = 'Pending',
            payment_status = 'pending',
            updated_at = NOW()
        WHERE id = NEW.user_id;
        
        RAISE NOTICE 'User % status synced to Pending due to payment %', NEW.user_id, NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_payment_pending_sync_member ON public.payments;

-- Re-create Trigger (Runs AFTER insert/update)
CREATE TRIGGER on_payment_pending_sync_member
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_membership_status_on_payment();

-- Re-run existing completed trigger just in case
-- (Already exists in 20260118_automate_membership_activation.sql)
