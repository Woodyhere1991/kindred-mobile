-- Drop all our id-verification policies
DROP POLICY IF EXISTS "id_verifications_insert" ON storage.objects;
DROP POLICY IF EXISTS "id_verifications_update" ON storage.objects;
DROP POLICY IF EXISTS "id_verifications_delete" ON storage.objects;
DROP POLICY IF EXISTS "id_verifications_select" ON storage.objects;

-- Recreate with TO public (covers both anon and authenticated)
CREATE POLICY "id_verifications_insert" ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'id-verifications');

CREATE POLICY "id_verifications_select" ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'id-verifications');

CREATE POLICY "id_verifications_update" ON storage.objects FOR UPDATE
  TO public
  USING (bucket_id = 'id-verifications')
  WITH CHECK (bucket_id = 'id-verifications');

CREATE POLICY "id_verifications_delete" ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'id-verifications');
