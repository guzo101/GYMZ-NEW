UPDATE public.users SET role = 'admin' WHERE email = 'ratifah@msafiristudios.com';

DO $$
DECLARE
    ratifah_id uuid;
BEGIN
    SELECT id INTO ratifah_id FROM auth.users WHERE email = 'ratifah@msafiristudios.com';
    IF ratifah_id IS NOT NULL THEN
        INSERT INTO public.users (id, email, name, role, status, membership_status)
        VALUES (ratifah_id, 'ratifah@msafiristudios.com', 'Ratifah Admin', 'admin', 'active', 'Pending')
        ON CONFLICT (id) DO UPDATE SET role = 'admin';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
