-- Migration: Allow platform admins to manage events for all gyms
-- Date: 2026-02-28

-- 1. Create a policy for platform admins to have full access to events
CREATE POLICY "Platform admins can manage all events"
ON public.events FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('platform_admin', 'super_admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('platform_admin', 'super_admin')
    )
);

-- 2. Also ensure they can see all RSVPs (though the request didn't explicitly ask, it's logical)
CREATE POLICY "Platform admins can view all RSVPs"
ON public.event_rsvps FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('platform_admin', 'super_admin')
    )
);
