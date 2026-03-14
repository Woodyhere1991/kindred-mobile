-- Add archived flag to conversations for soft-delete after exchange completion
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
