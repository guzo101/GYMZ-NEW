-- Migration: Create Sponsors and Banner Ads tables for Phase 5

-- 1. Create the `sponsors` table
CREATE TABLE IF NOT EXISTS public.sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT,
    website_url TEXT,
    is_active BOOLEAN DEFAULT true,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gym admins can manage their sponsors"
ON public.sponsors FOR ALL
USING (gym_id IN (
    SELECT gym_id FROM public.users WHERE id = auth.uid()
));

CREATE POLICY "Members can view active sponsors for their gym"
ON public.sponsors FOR SELECT
USING (is_active = true AND gym_id IN (
    SELECT gym_id FROM public.users WHERE id = auth.uid()
));

-- 2. Create the `banner_ads` table
CREATE TABLE IF NOT EXISTS public.banner_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID REFERENCES public.sponsors(id) ON DELETE SET NULL,
    image_url TEXT NOT NULL,
    link_url TEXT,
    placement_type TEXT NOT NULL DEFAULT 'global'
        CHECK (placement_type IN ('global', 'event_home', 'gym_home', 'calendar')),
    is_active BOOLEAN DEFAULT true,
    impressions_count INTEGER DEFAULT 0,
    clicks_count INTEGER DEFAULT 0,
    gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.banner_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gym admins can manage their banner ads"
ON public.banner_ads FOR ALL
USING (gym_id IN (
    SELECT gym_id FROM public.users WHERE id = auth.uid()
));

CREATE POLICY "Members can view active banner ads for their gym"
ON public.banner_ads FOR SELECT
USING (is_active = true AND gym_id IN (
    SELECT gym_id FROM public.users WHERE id = auth.uid()
));

-- 3. RPCs to track analytics safely
CREATE OR REPLACE FUNCTION increment_banner_impression(banner_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.banner_ads SET impressions_count = impressions_count + 1 WHERE id = banner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_banner_click(banner_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.banner_ads SET clicks_count = clicks_count + 1 WHERE id = banner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
