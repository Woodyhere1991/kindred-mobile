-- Add lat/lng coordinates to profiles and items for proximity-based browsing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

ALTER TABLE public.items ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Partial index for bounding box queries on items with coordinates
CREATE INDEX IF NOT EXISTS idx_items_location ON public.items (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;
