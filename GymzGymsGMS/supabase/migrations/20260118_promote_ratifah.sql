-- ============================================
-- PROMOTE RATIFAH TO ADMIN
-- ============================================

-- Ensure the user exists in public.users and has the admin role
-- This handles cases where they might have signed up as member or trigger was slow.
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'ratifah@msafiristudios.com';

-- If they don't exist yet (e.g. trigger failed), we manually insert.
-- We need their auth.uid for this to be perfect, but the Update covers most bases.

DO $$
DECLARE
    ratifah_id uuid;
BEGIN
    SELECT id INTO ratifah_id FROM auth.users WHERE email = 'ratifah@msafiristudios.com';
    
    IF ratifah_id IS NOT NULL THEN
        INSERT INTO public.users (id, email, name, role, status, membership_status)
        VALUES (ratifah_id, 'ratifah@msafiristudios.com', 'Ratifah Admin', 'admin', 'active', 'Pending')
        ON CONFLICT (id) DO UPDATE SET role = 'admin';
        RAISE NOTICE 'Admin Identity Confirmed for Ratifah: %', ratifah_id;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
