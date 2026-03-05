-- ============================================
-- CRITICAL FIX: ADMIN VISIBILITY & RECURSION & DATA SYNC
-- ============================================

-- 1. Fix Payments RLS (Remove recursive subquery)
-- This ensures admins can see ALL payments without getting stuck in infinite loops
DROP POLICY IF EXISTS "Admins manage all payments" ON public.payments;
CREATE POLICY "Admins manage all payments"
ON public.payments
FOR ALL
TO authenticated
USING (
  public.check_user_is_admin()
  OR auth.jwt() ->> 'role' = 'service_role'
);

-- 2. Fix Notifications RLS
DROP POLICY IF EXISTS "Admins Full Access" ON public.notifications;
CREATE POLICY "Admins Full Access"
ON public.notifications
FOR ALL
TO authenticated
USING (
  public.check_user_is_admin()
  OR auth.jwt() ->> 'role' = 'service_role'
);

-- 3. Backfill Specific Missing Users (Zombie Check)
-- This takes users from auth.users that aren't in public.users and inserts them
DO $$
DECLARE
    v_user_email TEXT;
BEGIN
    -- General backfill for any "zombie" users
    INSERT INTO public.users (id, email, name, role, membership_status, status, created_at)
    SELECT 
        au.id, 
        au.email, 
        COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)), 
        'member', 
        'New', 
        'active',
        au.created_at
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Backfilled missing users from auth system';
END $$;

-- 4. Force sync of user_id/member_id and status/payment_status for ALL payment records
-- This repairs existing records where the App used one column (user_id) but GMS expects another (member_id)
UPDATE public.payments 
SET 
    member_id = COALESCE(member_id, user_id),
    user_id = COALESCE(user_id, member_id),
    payment_status = COALESCE(payment_status, status),
    status = COALESCE(status, payment_status);

-- 5. Update the handle_new_user trigger
-- Sets default status to 'New' instead of 'Pending' to prevent "Pending Approval" screen lockout
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
    user_role TEXT := 'member';
BEGIN
    user_name := COALESCE(
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'full_name',
        split_part(new.email, '@', 1),
        'User'
    );

    INSERT INTO public.users (id, email, name, role, membership_status, status, created_at, metadata)
    VALUES (new.id, new.email, user_name, user_role, 'New', 'active', new.created_at, new.raw_user_meta_data)
    ON CONFLICT (id) DO NOTHING;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. System Audit Notif
INSERT INTO public.notifications (message, type, priority, is_read)
SELECT 
    'SYSTEM FIX APPLIED: Synced ' || count(*) || ' payments and users. Verify Finances screen.',
    'system_alert',
    1,
    false
FROM public.payments
WHERE status IN ('pending', 'pending_approval')
LIMIT 1;

NOTIFY pgrst, 'reload schema';
