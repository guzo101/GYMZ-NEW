-- Ensure vital columns exist on Users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS membership_status text DEFAULT 'Inactive';

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'Inactive';

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS membership_type text;

-- Also ensure Payments table has vital columns (just in case logic changed)
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS months numeric DEFAULT 1;

-- Now re-run the Force Sync
UPDATE public.users u
SET 
  membership_status = 'Active',
  status = 'Active',
  payment_status = 'completed'
FROM public.payments p
WHERE p.user_id = u.id
AND p.status IN ('completed', 'approved')
AND p.paid_at > (NOW() - INTERVAL '45 days');
