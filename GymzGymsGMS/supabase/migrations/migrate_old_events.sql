-- Run this in your Supabase SQL Editor to move your old events to the new table

INSERT INTO public.events (
    id, 
    title, 
    description, 
    location, 
    event_date, 
    end_date, 
    gym_id, 
    is_active, 
    created_at, 
    updated_at
)
SELECT 
    g.id,
    g.title,
    g.description,
    g.location,
    -- Combine date and time into a single timestamp (event_date is a DATE in gym_events)
    (g.event_date + coalesce(g.start_time, '00:00:00')::time) AT TIME ZONE 'UTC',
    (g.event_date + coalesce(g.end_time, '23:59:59')::time) AT TIME ZONE 'UTC',
    -- Fetch the gym_id from the user who created the event
    u.gym_id,
    true,
    g.created_at,
    g.updated_at
FROM public.gym_events g
JOIN public.users u ON g.created_by = u.id
WHERE u.gym_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;
