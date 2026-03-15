-- Allow admins to update any profile
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Allow admins to insert into points_log for any user
CREATE POLICY "Admins can insert points_log" ON public.points_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Create a SECURITY DEFINER function for admin verification approval
-- This bypasses RLS so the admin can update the target user's profile and award points
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
  -- Verify the caller is an admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = admin_uuid AND is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get the verification record
  SELECT user_id INTO target_user_id
  FROM id_verifications WHERE id = verification_uuid;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Verification not found';
  END IF;

  -- Update verification status
  UPDATE id_verifications
  SET status = 'approved', reviewed_by = admin_uuid, updated_at = NOW()
  WHERE id = verification_uuid;

  -- Set user as verified
  UPDATE profiles
  SET id_verified = true, updated_at = NOW()
  WHERE id = target_user_id;

  -- Check if user is premium for bonus points
  SELECT is_premium INTO user_is_premium
  FROM profiles WHERE id = target_user_id;
  
  verify_kp := CASE WHEN user_is_premium THEN 200 ELSE 100 END;

  -- Award points
  UPDATE profiles
  SET points = points + verify_kp
  WHERE id = target_user_id;

  -- Log points
  INSERT INTO points_log (user_id, action, points)
  VALUES (
    target_user_id,
    'for completing ID verification' || CASE WHEN user_is_premium THEN ' (2x Plus bonus)' ELSE '' END,
    verify_kp
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also create one for rejection
CREATE OR REPLACE FUNCTION public.admin_reject_verification(
  verification_uuid UUID,
  admin_uuid UUID,
  reject_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Verify the caller is an admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = admin_uuid AND is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE id_verifications
  SET status = 'rejected', reviewed_by = admin_uuid,
      rejection_reason = reject_reason, updated_at = NOW()
  WHERE id = verification_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
