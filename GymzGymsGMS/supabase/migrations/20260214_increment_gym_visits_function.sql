-- Helper SQL function for incrementing gym visits
-- Add this as a separate migration or append to main migration

CREATE OR REPLACE FUNCTION increment_gym_visits(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users
    SET 
        last_gym_visit = NOW(),
        total_gym_visits = COALESCE(total_gym_visits, 0) + 1
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_gym_visits IS 'Atomically increment user gym visit count and update last visit time';
