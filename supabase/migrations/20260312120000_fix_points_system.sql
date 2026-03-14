-- Add is_premium column for future paid tier
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;

-- New RPC: award points for creating a listing (does NOT touch exchange counters)
-- Enforces 3/day limit for free users
CREATE OR REPLACE FUNCTION public.award_listing_points(user_uuid UUID, points_to_add INTEGER)
RETURNS VOID AS $$
DECLARE
  listing_count INTEGER;
  user_premium BOOLEAN;
BEGIN
  -- Check if user is premium
  SELECT is_premium INTO user_premium FROM public.profiles WHERE id = user_uuid;

  -- Count listings created today by this user
  SELECT COUNT(*) INTO listing_count
  FROM public.items
  WHERE user_id = user_uuid
    AND created_at >= (NOW() AT TIME ZONE 'UTC')::date;

  -- Enforce daily limit for free users
  IF listing_count > 3 AND (user_premium IS NULL OR user_premium = FALSE) THEN
    RAISE EXCEPTION 'DAILY_LIMIT_REACHED';
  END IF;

  -- Award points only (no exchange counter changes)
  UPDATE public.profiles
  SET points = points + points_to_add,
      updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- New RPC: award points for completing an exchange (updates exchange counters)
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

-- Drop and recreate award_points with correct parameter names (deployed version uses 'points' not 'points_to_add')
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
