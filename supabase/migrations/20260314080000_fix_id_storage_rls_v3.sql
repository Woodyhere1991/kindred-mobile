-- Drop all existing id-verifications storage policies
DROP POLICY IF EXISTS "Users upload own ID docs" ON storage.objects;
DROP POLICY IF EXISTS "Users update own ID docs" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own ID docs" ON storage.objects;

-- Simple policy: any authenticated user can upload to id-verifications bucket
CREATE POLICY "Authenticated users upload ID docs" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'id-verifications');

-- Any authenticated user can update their uploads
CREATE POLICY "Authenticated users update ID docs" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'id-verifications')
  WITH CHECK (bucket_id = 'id-verifications');

-- Any authenticated user can delete their uploads
CREATE POLICY "Authenticated users delete ID docs" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'id-verifications');
