-- Fix matches where both sides confirmed but status is still 'accepted'
UPDATE matches
SET status = 'completed', updated_at = NOW()
WHERE status = 'accepted'
AND giver_confirmed_at IS NOT NULL
AND receiver_confirmed_at IS NOT NULL;

-- Fix items that have a completed or fully-confirmed match but are still listed/matched
UPDATE items
SET status = 'completed', updated_at = NOW()
WHERE status IN ('listed', 'matched')
AND id IN (
  SELECT DISTINCT m.item_id
  FROM matches m
  WHERE m.status = 'completed'
     OR (m.giver_confirmed_at IS NOT NULL AND m.receiver_confirmed_at IS NOT NULL)
);
