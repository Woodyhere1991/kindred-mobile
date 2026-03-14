-- Add message column to matches table for offer messages
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS message TEXT;
