-- Add FK from id_verifications.user_id to profiles.id so PostgREST can join
ALTER TABLE public.id_verifications
  ADD CONSTRAINT id_verifications_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id);
