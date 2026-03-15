-- Add meetup arrangement fields to matches table
-- Stores the agreed meetup location, address, and time

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS meetup_location TEXT,
  ADD COLUMN IF NOT EXISTS meetup_address TEXT,
  ADD COLUMN IF NOT EXISTS meetup_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meetup_set_by UUID REFERENCES auth.users(id);
