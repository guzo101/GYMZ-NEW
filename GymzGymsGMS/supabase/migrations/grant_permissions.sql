GRANT ALL ON TABLE public.looms TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.loom_members TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.loom_posts TO anon, authenticated, service_role;

-- Force refresh one last time
NOTIFY pgrst, 'reload schema';
