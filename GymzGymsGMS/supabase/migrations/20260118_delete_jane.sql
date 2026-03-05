-- DELETE JANE
DELETE FROM public.users WHERE email = 'jane@msafiristudios.com';
NOTIFY pgrst, 'reload schema';
