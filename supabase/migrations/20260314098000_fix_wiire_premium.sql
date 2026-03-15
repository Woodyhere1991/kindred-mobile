-- The admin toggle for Wiire's Plus status was blocked by RLS too
-- Fix: set is_premium = true and award the missing 100 KP bonus
UPDATE profiles
SET is_premium = true, updated_at = NOW()
WHERE id = 'aae87094-eca0-472f-a30c-fad9661482e6';

-- Award the extra 100 KP they missed (should have been 200 total for Plus, got 100)
UPDATE profiles
SET points = points + 100
WHERE id = 'aae87094-eca0-472f-a30c-fad9661482e6';

-- Update the points log entry
UPDATE points_log
SET action = 'for completing ID verification (2x Plus bonus)', points = 200
WHERE user_id = 'aae87094-eca0-472f-a30c-fad9661482e6'
  AND action LIKE '%ID verification%';
