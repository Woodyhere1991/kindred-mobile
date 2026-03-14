-- Add hold preference to items (giver chooses when creating listing)
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS hold_mode TEXT DEFAULT 'first_come';

-- Add hold fields to matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS hold_until TIMESTAMPTZ;

-- Update matches status constraint to include 'held'
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_status_check
  CHECK (status IN ('pending', 'held', 'accepted', 'declined', 'completed', 'cancelled'));
