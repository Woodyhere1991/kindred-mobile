-- Make daily listing limit tier-aware based on KP tier
-- Seedling/Helper: 3/day, Guardian: 5/day, Beacon: 7/day, Luminary: 10/day
-- Premium users: unlimited

CREATE OR REPLACE FUNCTION public.award_listing_points(user_uuid UUID, points_to_add INTEGER)
RETURNS VOID AS $$
DECLARE
  listing_count INTEGER;
  user_premium BOOLEAN;
  user_points INTEGER;
  daily_limit INTEGER;
BEGIN
  -- Get user info
  SELECT is_premium, points INTO user_premium, user_points
  FROM public.profiles WHERE id = user_uuid;

  -- Premium users have no limit
  IF user_premium = TRUE THEN
    UPDATE public.profiles
    SET points = points + points_to_add, updated_at = NOW()
    WHERE id = user_uuid;
    RETURN;
  END IF;

  -- Determine daily limit based on tier
  IF user_points >= 15000 THEN
    daily_limit := 10;  -- Luminary
  ELSIF user_points >= 5000 THEN
    daily_limit := 7;   -- Beacon
  ELSIF user_points >= 1000 THEN
    daily_limit := 5;   -- Guardian
  ELSE
    daily_limit := 3;   -- Seedling / Helper
  END IF;

  -- Count listings created today
  SELECT COUNT(*) INTO listing_count
  FROM public.items
  WHERE user_id = user_uuid
    AND created_at >= (NOW() AT TIME ZONE 'UTC')::date;

  -- Enforce limit
  IF listing_count > daily_limit THEN
    RAISE EXCEPTION 'DAILY_LIMIT_REACHED:%', daily_limit;
  END IF;

  UPDATE public.profiles
  SET points = points + points_to_add, updated_at = NOW()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
