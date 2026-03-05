-- ============================================
-- INSTALL SAFE TRIGGER (Prevents Zombies)
-- ============================================

-- 1. Create the Function (SIMPLIFIED & SAFE)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    -- Just Insert. If it fails, log it but don't crash Auth.
    -- We use exception handling block to prevent Auth failure.
    BEGIN
        INSERT INTO public.users (
            id, 
            email, 
            name, 
            role, 
            status, 
            membership_status, 
            unique_id, 
            thread_id,
            created_at, 
            metadata
        )
        VALUES (
            new.id, 
            new.email, 
            -- Safe Name Fallback
            COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
            -- Force DEFAULT role (prevent hacky role injection via metadata)
            'member', 
            'active', 
            'Pending', 
            -- Generate Random Unique ID
            (floor(random() * 9000 + 1000)::text) || (ARRAY['!','@','#','$','%','^','&','*'])[floor(random() * 8 + 1)],
            -- Generate Thread ID
            gen_random_uuid()::text,
            new.created_at, 
            new.raw_user_meta_data
        )
        ON CONFLICT (id) DO NOTHING; -- Idempotency
        
    EXCEPTION WHEN OTHERS THEN
        -- If something goes wrong, DO NOT FAIL THE SIGNUP.
        -- Just warn in logs. The user can be fixed later.
        RAISE WARNING 'User Profile Creation Failed: %', SQLERRM;
        RETURN new; 
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- Runs as Superuser (Bypasses RLS)

-- 2. Attach Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Reload Schema
NOTIFY pgrst, 'reload schema';
