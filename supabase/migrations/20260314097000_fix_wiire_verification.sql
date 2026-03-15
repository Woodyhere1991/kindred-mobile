-- Fix Wiire's verification that was "approved" but didn't actually update
-- Find any approved verifications where the user's profile isn't marked as verified
DO $$
DECLARE
  v RECORD;
  user_is_premium BOOLEAN;
  verify_kp INTEGER;
BEGIN
  FOR v IN
    SELECT iv.id, iv.user_id
    FROM id_verifications iv
    JOIN profiles p ON p.id = iv.user_id
    WHERE iv.status = 'approved' AND p.id_verified = false
  LOOP
    -- Set user as verified
    UPDATE profiles SET id_verified = true, updated_at = NOW()
    WHERE id = v.user_id;

    -- Check premium status for bonus
    SELECT is_premium INTO user_is_premium FROM profiles WHERE id = v.user_id;
    verify_kp := CASE WHEN user_is_premium THEN 200 ELSE 100 END;

    -- Award points
    UPDATE profiles SET points = points + verify_kp WHERE id = v.user_id;

    -- Log points (check if already logged to avoid duplicates)
    IF NOT EXISTS (
      SELECT 1 FROM points_log
      WHERE user_id = v.user_id AND action LIKE '%ID verification%'
    ) THEN
      INSERT INTO points_log (user_id, action, points)
      VALUES (v.user_id, 'for completing ID verification' || CASE WHEN user_is_premium THEN ' (2x Plus bonus)' ELSE '' END, verify_kp);
    END IF;

    RAISE NOTICE 'Fixed verification for user %: awarded % KP', v.user_id, verify_kp;
  END LOOP;
END $$;
