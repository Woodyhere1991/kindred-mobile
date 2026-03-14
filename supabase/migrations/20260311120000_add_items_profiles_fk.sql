-- Add foreign key from items.user_id to profiles.id so Supabase can join them
ALTER TABLE public.items
  ADD CONSTRAINT items_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
