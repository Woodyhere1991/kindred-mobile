-- First, drop ALL policies on storage.objects that mention id-verifications
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND (
        qual::text ILIKE '%id-verifications%'
        OR with_check::text ILIKE '%id-verifications%'
        OR policyname ILIKE '%id%'
        OR policyname ILIKE '%verification%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Now create clean policies for the id-verifications bucket
CREATE POLICY "id_verifications_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'id-verifications');

CREATE POLICY "id_verifications_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'id-verifications')
  WITH CHECK (bucket_id = 'id-verifications');

CREATE POLICY "id_verifications_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'id-verifications');

CREATE POLICY "id_verifications_select" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'id-verifications');
