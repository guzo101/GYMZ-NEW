-- 1. Sync 'Mex' specifically (Update ID if email exists, otherwise insert)
INSERT INTO public.users (id, email, name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'User')
FROM auth.users
WHERE email = 'mex@gmail.com'
ON CONFLICT (email) DO UPDATE 
SET id = excluded.id; -- Vital: Aligns public ID with Auth ID

-- 2. Sync ALL users (Fixes everyone else too)
INSERT INTO public.users (id, email, name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'User')
FROM auth.users
ON CONFLICT (id) DO NOTHING; -- If ID matches, we are good.
-- Note: We generally don't want to overwrite excisting data for others, just fill gaps.

-- 3. Ensure Trigger exists for FUTURE users
-- This ensures any NEW signups automatically get a public.users row
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-bind trigger just in case
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
