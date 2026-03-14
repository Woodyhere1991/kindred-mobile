-- Add image_url column to messages for photo sharing in chat
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url TEXT;
