-- ============================================
-- AUTO-GENERATE UNIQUE ID - January 2026
-- Ensures every user gets a '1234@' style ID
-- ============================================

-- 1. Create a function to generate the ID
CREATE OR REPLACE FUNCTION public.generate_unique_user_id()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 
    -- 4 random digits (1000-9999)
    (floor(random() * 9000 + 1000)::text) || 
    -- 1 random special char
    (ARRAY['!','@','#','$','%','^','&','*','(',')','_','+','-','=','[',']','{','}','|',';',':',',','.','<','>','?'])[floor(random() * 26 + 1)];
$$;

-- 2. Update the `handle_new_user` trigger to use it
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
    new_unique_id TEXT;
BEGIN
    -- Extract name
    user_name := COALESCE(
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'full_name',
        split_part(new.email, '@', 1),
        'User'
    );

    -- Generate a unique ID (simple retry logic could be added, but collision is rare enough for now)
    new_unique_id := public.generate_unique_user_id();

    -- Insert into public.users
    INSERT INTO public.users (
        id, 
        email, 
        name, 
        role, 
        membership_status,
        status,
        unique_id,  -- <--- ADDED THIS
        created_at,
        metadata
    )
    VALUES (
        new.id, 
        new.email, 
        user_name, 
        'member', 
        'Pending',
        'active',
        new_unique_id, -- <--- ADDED THIS
        new.created_at,
        new.raw_user_meta_data
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        name = COALESCE(public.users.name, EXCLUDED.name),
        unique_id = COALESCE(public.users.unique_id, EXCLUDED.unique_id), -- Keep existing if there
        updated_at = NOW();

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill existing users who have NULL unique_id
UPDATE public.users 
SET unique_id = public.generate_unique_user_id()
WHERE unique_id IS NULL;

-- 4. Reload schema
NOTIFY pgrst, 'reload schema';
