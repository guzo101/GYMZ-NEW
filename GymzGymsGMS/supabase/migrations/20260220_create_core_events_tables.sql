-- Migration: Create Events and Event RSVPs tables for Phase 4/5 Event Management

-- 1. Create the `events` table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    capacity INTEGER,
    rsvp_count INTEGER DEFAULT 0,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active events for their gym
CREATE POLICY "Users can view active events for their gym"
ON public.events FOR SELECT
USING (is_active = true AND gym_id IN (
    SELECT gym_id FROM public.users WHERE id = auth.uid()
));

-- Policy: Admins can manage events for their gym
CREATE POLICY "Admins can insert events for their gym"
ON public.events FOR INSERT
WITH CHECK (gym_id IN (
    SELECT gym_id FROM public.users WHERE id = auth.uid()
));

CREATE POLICY "Admins can update events for their gym"
ON public.events FOR UPDATE
USING (gym_id IN (
    SELECT gym_id FROM public.users WHERE id = auth.uid()
));

CREATE POLICY "Admins can delete events for their gym"
ON public.events FOR DELETE
USING (gym_id IN (
    SELECT gym_id FROM public.users WHERE id = auth.uid()
));

-- 2. Create the `event_rsvps` table
CREATE TABLE IF NOT EXISTS public.event_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('confirmed', 'waitlisted', 'cancelled')),
    qr_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- Enable RLS for event_rsvps
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own RSVPs
CREATE POLICY "Users can view their own RSVPs"
ON public.event_rsvps FOR SELECT
USING (user_id = auth.uid());

-- Policy: Admins can view all RSVPs for their gym's events
CREATE POLICY "Admins can view RSVPs for their gym"
ON public.event_rsvps FOR SELECT
USING (gym_id IN (
    SELECT gym_id FROM public.users WHERE id = auth.uid()
));

-- Policy: Users can insert their own RSVPs
CREATE POLICY "Users can RSVP to events"
ON public.event_rsvps FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own RSVPs 
CREATE POLICY "Users can update their RSVPs"
ON public.event_rsvps FOR UPDATE
USING (user_id = auth.uid());

-- 3. Triggers for updating RSVP count
CREATE OR REPLACE FUNCTION update_event_rsvp_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' THEN
        UPDATE public.events SET rsvp_count = rsvp_count + 1 WHERE id = NEW.event_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
            UPDATE public.events SET rsvp_count = rsvp_count + 1 WHERE id = NEW.event_id;
        ELSIF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
            UPDATE public.events SET rsvp_count = rsvp_count - 1 WHERE id = NEW.event_id;
        END IF;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'confirmed' THEN
        UPDATE public.events SET rsvp_count = rsvp_count - 1 WHERE id = OLD.event_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_event_rsvp_count ON public.event_rsvps;
CREATE TRIGGER trg_update_event_rsvp_count
AFTER INSERT OR UPDATE OR DELETE ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION update_event_rsvp_count();
