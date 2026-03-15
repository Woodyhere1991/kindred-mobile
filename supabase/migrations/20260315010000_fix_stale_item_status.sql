-- Fix items that have a completed match but are still marked as 'listed' or 'matched'
UPDATE items
SET status = 'completed', updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT m.item_id
  FROM matches m
  WHERE m.status = 'completed'
)
AND status IN ('listed', 'matched');
