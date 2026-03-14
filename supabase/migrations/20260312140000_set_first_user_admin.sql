-- Set the first registered user as admin
UPDATE public.profiles SET is_admin = true
WHERE id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1);
