-- Add foreign key from user_blocks.blocked_id to profiles for join queries
ALTER TABLE public.user_blocks
  ADD CONSTRAINT user_blocks_blocked_id_profiles_fkey
  FOREIGN KEY (blocked_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
