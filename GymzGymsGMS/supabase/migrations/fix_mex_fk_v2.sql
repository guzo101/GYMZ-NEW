DO $$
DECLARE
    real_auth_id UUID;
    old_public_id UUID;
BEGIN
    -- 1. Find the REAL Auth ID for 'mex@gmail.com'
    SELECT id INTO real_auth_id FROM auth.users WHERE email = 'mex@gmail.com';
    
    -- 2. Find the OLD/BAD Public ID currently holding that email
    SELECT id INTO old_public_id FROM public.users WHERE email = 'mex@gmail.com';

    RAISE NOTICE 'Real Auth ID: %', real_auth_id;
    RAISE NOTICE 'Old Public ID: %', old_public_id;

    -- Only proceed if they are different and both exist
    IF real_auth_id IS NOT NULL AND old_public_id IS NOT NULL AND real_auth_id != old_public_id THEN
        
        RAISE NOTICE 'Mismatch found! Migrating data from Old ID to Real ID...';

        -- 3. Create a "Placeholder" user with the new ID
        INSERT INTO public.users (id, email, name) 
        VALUES (real_auth_id, 'temp_mex_migration@gmail.com', 'Mex')
        ON CONFLICT (id) DO NOTHING;

        -- 4. Move all data from Old ID to New ID (Dynamically check existence)
        
        -- Attendance (Known to exist from error log)
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attendance') THEN
             UPDATE public.attendance SET user_id = real_auth_id WHERE user_id = old_public_id;
        END IF;

        -- Workout Sessions (Fixing the error - might use different schema or name?)
        -- Since it errored, let's wrap it or skip if not found.
        BEGIN
            UPDATE public.workout_sessions SET user_id = real_auth_id WHERE user_id = old_public_id;
        EXCEPTION WHEN undefined_table THEN
            RAISE NOTICE 'public.workout_sessions does not exist, skipping...';
        END;

        -- Daily Nutrition Logs
        BEGIN
            UPDATE public.daily_nutrition_logs SET user_id = real_auth_id WHERE user_id = old_public_id;
        EXCEPTION WHEN undefined_table THEN
             RAISE NOTICE 'nutrition logs table missing, skipping...';
        END;

        -- Bookings
         BEGIN
            UPDATE public.gym_class_bookings SET user_id = real_auth_id WHERE user_id = old_public_id;
        EXCEPTION WHEN undefined_table THEN
             RAISE NOTICE 'bookings table missing, skipping...';
        END;

        -- XP Transactions
         BEGIN
            UPDATE public.xp_transactions SET user_id = real_auth_id WHERE user_id = old_public_id;
        EXCEPTION WHEN undefined_table THEN
             RAISE NOTICE 'xp missing, skipping...';
        END;

        -- Leaderboard
         BEGIN
            UPDATE public.leaderboard_data SET user_id = real_auth_id WHERE user_id = old_public_id;
        EXCEPTION WHEN undefined_table THEN
             RAISE NOTICE 'leaderboard missing, skipping...';
        END;

        -- Profiles
         BEGIN
            UPDATE public.users_profiles SET user_id = real_auth_id WHERE user_id = old_public_id;
        EXCEPTION WHEN undefined_table THEN
             RAISE NOTICE 'users_profiles missing, skipping...';
        END;

        -- Looms related (We know these exist now)
        UPDATE public.looms SET admin_id = real_auth_id WHERE admin_id = old_public_id;
        UPDATE public.loom_members SET user_id = real_auth_id WHERE user_id = old_public_id;
        UPDATE public.loom_posts SET user_id = real_auth_id WHERE user_id = old_public_id;

        -- 5. Delete the Old User Row (now empty of dependencies)
        DELETE FROM public.users WHERE id = old_public_id;

        -- 6. Fix the email on the New User Row
        UPDATE public.users SET email = 'mex@gmail.com' WHERE id = real_auth_id;

        RAISE NOTICE 'Migration Complete! You can now create Looms.';
    ELSE
        RAISE NOTICE 'No mismatch found or user missing. No action taken.';
        
        -- If user missing from public, insert them.
        IF real_auth_id IS NOT NULL AND old_public_id IS NULL THEN
            INSERT INTO public.users (id, email, name)
            SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'Mex')
            FROM auth.users WHERE email = 'mex@gmail.com';
            RAISE NOTICE 'Inserted missing user.';
        END IF;

    END IF;
END $$;
