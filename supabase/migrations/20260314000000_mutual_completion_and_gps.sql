-- Mutual completion: track each party's confirmation separately
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS giver_confirmed_at TIMESTAMPTZ;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS receiver_confirmed_at TIMESTAMPTZ;

-- GPS check-in locations captured at confirmation time
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS giver_lat DOUBLE PRECISION;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS giver_lng DOUBLE PRECISION;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS receiver_lat DOUBLE PRECISION;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS receiver_lng DOUBLE PRECISION;

-- Proximity verification on exchange receipts
ALTER TABLE public.exchange_receipts ADD COLUMN IF NOT EXISTS proximity_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.exchange_receipts ADD COLUMN IF NOT EXISTS proximity_distance_m INTEGER;
