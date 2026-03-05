DO $$
DECLARE
    v_user_id uuid;
    v_email text := 'olivia@msafiristudios.com';
    v_confirmed_at timestamptz;
    v_public_exists boolean;
BEGIN
    -- 1. Check Auth User
    SELECT id, email_confirmed_at INTO v_user_id, v_confirmed_at
    FROM auth.users 
    WHERE email = v_email;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'USER_DEBUG: Auth User NOT FOUND for %', v_email;
    ELSE
        RAISE NOTICE 'USER_DEBUG: Auth User Found. ID: %, ConfirmedAt: %', v_user_id, v_confirmed_at;
    END IF;

    -- 2. Check Public Profile
    SELECT EXISTS(SELECT 1 FROM public.users WHERE email = v_email) INTO v_public_exists;

    RAISE NOTICE 'USER_DEBUG: Public Profile Exists? %', v_public_exists;

    -- 3. Diagnostics
    IF v_user_id IS NOT NULL AND v_confirmed_at IS NULL THEN
         RAISE NOTICE 'USER_DEBUG: DIAGNOSIS -> User exists but Email is NOT confirmed in auth.users.';
    ELSIF v_user_id IS NOT NULL AND NOT v_public_exists THEN
         RAISE NOTICE 'USER_DEBUG: DIAGNOSIS -> User exists and confirmed, but Public Profile is MISSING (Zombie).';
    ELSIF v_user_id IS NOT NULL AND v_confirmed_at IS NOT NULL AND v_public_exists THEN
         RAISE NOTICE 'USER_DEBUG: DIAGNOSIS -> Everything looks correct DB-wise. Issue likely Password mismatch.';
    END IF;

END $$;
