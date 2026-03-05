-- ============================================
-- UPGRADE AUTH TRIGGER: SMARTER DATA SYNC
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
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
            metadata,
            gender,
            phone,
            avatar_url
        )
        VALUES (
            new.id, 
            new.email, 
            COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
            -- Role logic: Default to member, but allow override if explicitly set in meta (e.g. by admin)
            COALESCE(new.raw_user_meta_data->>'role', 'member'), 
            'active', 
            'Pending', 
            -- Generate Unique ID
            (floor(random() * 9000 + 1000)::text) || (ARRAY['!','@','#','$','%','^','&','*'])[floor(random() * 8 + 1)],
            -- Generate Thread ID
            gen_random_uuid()::text,
            new.created_at, 
            new.raw_user_meta_data,
            new.raw_user_meta_data->>'gender',
            new.raw_user_meta_data->>'phone',
            new.raw_user_meta_data->>'avatar_url'
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            name = COALESCE(EXCLUDED.name, public.users.name),
            metadata = public.users.metadata || EXCLUDED.metadata,
            gender = COALESCE(EXCLUDED.gender, public.users.gender),
            phone = COALESCE(EXCLUDED.phone, public.users.phone),
            avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url);
        
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'User Profile Creation/Sync Failed: %', SQLERRM;
        RETURN new; 
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload
NOTIFY pgrst, 'reload schema';
