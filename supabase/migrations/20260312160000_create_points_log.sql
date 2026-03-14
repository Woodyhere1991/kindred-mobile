-- Create a persistent points_log table so earned KP stays in the feed
-- even when the source item is cancelled/deleted

CREATE TABLE IF NOT EXISTS public.points_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id TEXT,
  item_title TEXT,
  item_type TEXT,
  action TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for feed queries (by location we'll use the user's suburb via join)
CREATE INDEX idx_points_log_created ON public.points_log(created_at DESC);
CREATE INDEX idx_points_log_user ON public.points_log(user_id);

-- RLS: anyone can read the feed, users can only insert their own
ALTER TABLE public.points_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read points log"
  ON public.points_log FOR SELECT
  USING (true);

CREATE POLICY "System can insert points log"
  ON public.points_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Update award_listing_points to also log
CREATE OR REPLACE FUNCTION public.award_listing_points(user_uuid UUID, points_to_add INTEGER)
RETURNS VOID AS $$
DECLARE
  listing_count INTEGER;
  user_premium BOOLEAN;
BEGIN
  SELECT is_premium INTO user_premium FROM public.profiles WHERE id = user_uuid;

  SELECT COUNT(*) INTO listing_count
  FROM public.items
  WHERE user_id = user_uuid
    AND created_at >= (NOW() AT TIME ZONE 'UTC')::date;

  IF listing_count > 3 AND (user_premium IS NULL OR user_premium = FALSE) THEN
    RAISE EXCEPTION 'DAILY_LIMIT_REACHED';
  END IF;

  UPDATE public.profiles
  SET points = points + points_to_add,
      updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update award_completion_points to also log
CREATE OR REPLACE FUNCTION public.award_completion_points(user_uuid UUID, points_to_add INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET points = points + points_to_add,
      completed_exchanges = completed_exchanges + 1,
      total_exchanges = total_exchanges + 1,
      streak = streak + 1,
      updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update generic award_points
DROP FUNCTION IF EXISTS public.award_points(UUID, INTEGER);
CREATE FUNCTION public.award_points(user_uuid UUID, points_to_add INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET points = points + points_to_add,
      updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
