-- Update notification text in admin functions to say "Kindness Points" instead of "KP"
CREATE OR REPLACE FUNCTION public.admin_approve_verification(
  verification_uuid UUID,
  admin_uuid UUID
)
RETURNS VOID AS $$
DECLARE
  target_user_id UUID;
  user_is_premium BOOLEAN;
  verify_kp INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = admin_uuid AND is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT user_id INTO target_user_id
  FROM id_verifications WHERE id = verification_uuid;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Verification not found';
  END IF;

  UPDATE id_verifications
  SET status = 'approved', reviewed_by = admin_uuid, updated_at = NOW()
  WHERE id = verification_uuid;

  UPDATE profiles
  SET id_verified = true, updated_at = NOW()
  WHERE id = target_user_id;

  SELECT is_premium INTO user_is_premium
  FROM profiles WHERE id = target_user_id;
  
  verify_kp := CASE WHEN user_is_premium THEN 200 ELSE 100 END;

  UPDATE profiles
  SET points = points + verify_kp
  WHERE id = target_user_id;

  INSERT INTO points_log (user_id, action, points)
  VALUES (
    target_user_id,
    'for completing ID verification' || CASE WHEN user_is_premium THEN ' (2x Plus bonus)' ELSE '' END,
    verify_kp
  );

  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    target_user_id,
    'verification',
    'ID Verified! 🛡️',
    'Your ID has been verified! You earned +' || verify_kp || ' Kindness Points' || CASE WHEN user_is_premium THEN ' (2x Plus bonus)' ELSE '' END || '. Your gold badge is now active.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_reject_verification(
  verification_uuid UUID,
  admin_uuid UUID,
  reject_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  target_user_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = admin_uuid AND is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT user_id INTO target_user_id
  FROM id_verifications WHERE id = verification_uuid;

  UPDATE id_verifications
  SET status = 'rejected', reviewed_by = admin_uuid,
      rejection_reason = reject_reason, updated_at = NOW()
  WHERE id = verification_uuid;

  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    target_user_id,
    'verification',
    'Verification Update',
    'Your ID verification was not approved' || CASE WHEN reject_reason IS NOT NULL THEN ': ' || reject_reason ELSE '' END || '. You can try again with a different document.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
