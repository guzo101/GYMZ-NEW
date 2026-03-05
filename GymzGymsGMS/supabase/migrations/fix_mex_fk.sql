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

        -- 3. Update all dependent tables (History Migration)
        -- We temporarily disable triggers or constraints if needed, but simple UPDATE should work if we handle order.
        -- Actually, we can just UPDATE the Foreign Keys to the new ID.
        -- But first, we ensure the new ID doesn't already exist in the target tables? 
        -- If it does, we might have a merge conflict. Assuming it acts as "rename".

        -- Disable constraints temporarily to allow the switch? 
        -- No, better to update the children first. But we can't point children to a non-existent parent (if Real ID isn't in public.users yet).
        
        -- Strategy:
        -- A. Create the New User row (if not exists) or Update the Old User row?
        -- We cannot update Old User row ID yet because children point to it.
        -- We cannot insert New User row if email unique constraint exists.
        
        -- CORRECT ORDER:
        -- A. Create a dummy/holding row for the New ID if it doesn't exist? No, unique email prevents it.
        -- B. Drop the Unique Email Constraint? Risky.
        -- C. DEFER CONSTRAINTS? Supabase usually allows this.
        
        -- EASIEST STRATEGY: 
        -- 1. Create a "Placeholder" user with the new ID but a TEMPORARY email.
        INSERT INTO public.users (id, email, name) 
        VALUES (real_auth_id, 'temp_mex_migration@gmail.com', 'Mex')
        ON CONFLICT (id) DO NOTHING;

        -- 2. Move all data from Old ID to New ID
        UPDATE public.attendance SET user_id = real_auth_id WHERE user_id = old_public_id;
        UPDATE public.workout_sessions SET user_id = real_auth_id WHERE user_id = old_public_id;
        UPDATE public.daily_nutrition_logs SET user_id = real_auth_id WHERE user_id = old_public_id;
        UPDATE public.gym_class_bookings SET user_id = real_auth_id WHERE user_id = old_public_id;
        UPDATE public.xp_transactions SET user_id = real_auth_id WHERE user_id = old_public_id;
        UPDATE public.leaderboard_data SET user_id = real_auth_id WHERE user_id = old_public_id;
        UPDATE public.users_profiles SET user_id = real_auth_id WHERE user_id = old_public_id;
        
        -- Looms related
        UPDATE public.looms SET admin_id = real_auth_id WHERE admin_id = old_public_id;
        UPDATE public.loom_members SET user_id = real_auth_id WHERE user_id = old_public_id;
        UPDATE public.loom_posts SET user_id = real_auth_id WHERE user_id = old_public_id;

        -- 3. Delete the Old User Row (now empty of dependencies)
        DELETE FROM public.users WHERE id = old_public_id;

        -- 4. Fix the email on the New User Row
        UPDATE public.users SET email = 'mex@gmail.com' WHERE id = real_auth_id;

        RAISE NOTICE 'Migration Complete!';
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
