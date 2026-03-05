-- Fix the default membership status for new users to be 'New' instead of 'Pending'
-- This prevents the "Pending Approval" screen from showing before they have even paid.

-- 1. Update the column default
ALTER TABLE public.users ALTER COLUMN membership_status SET DEFAULT 'New';

-- 2. Update the trigger function to insert 'New' by default
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
    user_role TEXT := 'member';
BEGIN
    -- Extract name with fallbacks
    user_name := COALESCE(
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'full_name',
        split_part(new.email, '@', 1),
        'User'
    );

    -- Insert into public.users
    INSERT INTO public.users (
        id, 
        email, 
        name, 
        role, 
        membership_status,
        status,
        created_at,
        metadata
    )
    VALUES (
        new.id, 
        new.email, 
        user_name, 
        user_role, 
        'New',      -- CHANGED FROM 'Pending' to 'New'
        'active',   -- status for login access
        new.created_at,
        new.raw_user_meta_data
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        name = COALESCE(public.users.name, EXCLUDED.name),
        metadata = COALESCE(public.users.metadata, EXCLUDED.metadata),
        updated_at = NOW();

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix existing users who are 'Pending' but have NO pending payments
-- We want to reset them to 'New' so they can see the subscription plans.
UPDATE public.users u
SET membership_status = 'New'
WHERE membership_status = 'Pending'
AND NOT EXISTS (
    SELECT 1 FROM public.payments p 
    WHERE p.user_id = u.id 
    AND p.status = 'pending'
);
