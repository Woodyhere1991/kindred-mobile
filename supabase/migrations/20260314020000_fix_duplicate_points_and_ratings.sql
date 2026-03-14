-- Fix duplicate ratings and points caused by the rating modal re-triggering bug
-- 1. Remove duplicate reliability records (keep earliest per user_id/partner_id pair)
-- 2. Remove duplicate points_log entries (keep earliest per user_id/item_id/action-pattern)
-- 3. Recalculate profiles.points from deduplicated points_log
-- 4. Recalculate profiles.completed_exchanges from unique completed reliability records
-- 5. Fix exchange_receipts duplicates

-- Step 1: Delete duplicate reliability records (keep the one with the lowest id)
DELETE FROM public.reliability
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.reliability
  GROUP BY user_id, partner_id, completed
);

-- Step 2: Delete duplicate points_log entries for completion points
-- Keep earliest "for giving/receiving" entry per user per item
DELETE FROM public.points_log
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.points_log
  WHERE action LIKE 'for %'
  GROUP BY user_id, item_id
)
AND action LIKE 'for %';

-- Delete duplicate "First exchange bonus" entries (should only ever be one per user)
DELETE FROM public.points_log
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.points_log
  WHERE action LIKE 'First exchange bonus%'
  GROUP BY user_id
)
AND action LIKE 'First exchange bonus%';

-- Delete duplicate "5-star review" entries per user per item
DELETE FROM public.points_log
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.points_log
  WHERE action LIKE '5-star review%'
  GROUP BY user_id, item_id
)
AND action LIKE '5-star review%';

-- Step 3: Delete duplicate exchange_receipts (keep earliest per item_id)
DELETE FROM public.exchange_receipts
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.exchange_receipts
  GROUP BY item_id
);

-- Step 4: Recalculate profiles.points from the cleaned points_log
-- This ensures points match exactly what the log says
UPDATE public.profiles p
SET points = COALESCE(totals.total_points, 0)
FROM (
  SELECT user_id, SUM(points) AS total_points
  FROM public.points_log
  GROUP BY user_id
) totals
WHERE p.id = totals.user_id;

-- Step 5: Recalculate completed_exchanges from unique completed reliability records
-- A user's completed_exchanges = number of unique exchanges they participated in
UPDATE public.profiles p
SET completed_exchanges = COALESCE(counts.cnt, 0),
    total_exchanges = COALESCE(counts.cnt, 0)
FROM (
  SELECT user_id, COUNT(*) AS cnt
  FROM public.reliability
  WHERE completed = true
  GROUP BY user_id
) counts
WHERE p.id = counts.user_id;

-- Reset completed_exchanges to 0 for users with no reliability records
UPDATE public.profiles
SET completed_exchanges = 0, total_exchanges = 0
WHERE id NOT IN (
  SELECT DISTINCT user_id FROM public.reliability WHERE completed = true
);
