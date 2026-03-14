-- Add item_id to reliability table for duplicate rating prevention per exchange
ALTER TABLE public.reliability ADD COLUMN IF NOT EXISTS item_id BIGINT REFERENCES public.items(id) ON DELETE SET NULL;

-- Create unique index to prevent duplicate ratings per user per item
CREATE UNIQUE INDEX IF NOT EXISTS reliability_user_item_unique ON public.reliability(user_id, item_id) WHERE item_id IS NOT NULL;
