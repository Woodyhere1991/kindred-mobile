-- Drop and recreate storage policies for id-verifications with simpler path check
DROP POLICY IF EXISTS "Users upload own ID docs" ON storage.objects;
DROP POLICY IF EXISTS "Users update own ID docs" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own ID docs" ON storage.objects;

-- Users can upload to id-verifications bucket if path starts with their user ID
CREATE POLICY "Users upload own ID docs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'id-verifications' AND (auth.uid())::text = split_part(name, '/', 1));

CREATE POLICY "Users update own ID docs" ON storage.objects FOR UPDATE
  USING (bucket_id = 'id-verifications' AND (auth.uid())::text = split_part(name, '/', 1))
  WITH CHECK (bucket_id = 'id-verifications' AND (auth.uid())::text = split_part(name, '/', 1));

CREATE POLICY "Users delete own ID docs" ON storage.objects FOR DELETE
  USING (bucket_id = 'id-verifications' AND (auth.uid())::text = split_part(name, '/', 1));
