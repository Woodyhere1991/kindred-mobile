-- Reset the most recent completed exchange back to accepted/matched for testing mutual confirmation
-- This resets BOTH the match and the item

-- Reset match: status back to accepted, clear confirmation timestamps
UPDATE public.matches
SET status = 'accepted',
    giver_confirmed_at = NULL,
    receiver_confirmed_at = NULL,
    giver_lat = NULL,
    giver_lng = NULL,
    receiver_lat = NULL,
    receiver_lng = NULL
WHERE id = (
  SELECT id FROM public.matches
  WHERE status = 'completed'
  ORDER BY created_at DESC
  LIMIT 1
);

-- Reset the corresponding item back to matched
UPDATE public.items
SET status = 'matched'
WHERE id = (
  SELECT item_id FROM public.matches
  WHERE status = 'accepted'
  ORDER BY created_at DESC
  LIMIT 1
);
