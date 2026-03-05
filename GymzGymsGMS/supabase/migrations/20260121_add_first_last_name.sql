-- 1. ADD COLUMNS
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. BACKFILL DATA (Optional: Split existing name if possible)
-- Basic split: First word to first_name, the rest to last_name
UPDATE public.users 
SET 
    first_name = split_part(name, ' ', 1),
    last_name = CASE 
        WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
        ELSE ''
    END
WHERE (first_name IS NULL OR first_name = '') AND name IS NOT NULL;

-- 3. UPDATE SYNC LOGIC (Based on 20260120_restore_gms_users.sql)
-- We'll recreate the logic in the restoration script to include these columns
CREATE OR REPLACE FUNCTION public.sync_user_names()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.users pu
    SET 
        first_name = COALESCE(au.raw_user_meta_data->>'first_name', split_part(pu.name, ' ', 1)),
        last_name = COALESCE(au.raw_user_meta_data->>'last_name', CASE 
            WHEN position(' ' in pu.name) > 0 THEN substring(pu.name from position(' ' in pu.name) + 1)
            ELSE ''
        END)
    FROM auth.users au
    WHERE pu.id = au.id
    AND (pu.first_name IS NULL OR pu.last_name IS NULL);
END;
$$;

-- Run it once
SELECT public.sync_user_names();
