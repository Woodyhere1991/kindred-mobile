-- Track whose home was used for a meetup exchange
-- Count follows the person (not the address) so moving house doesn't affect stats

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS meetup_at_home_of UUID REFERENCES auth.users(id);
