-- Add UPDATE policy for id-verifications storage (needed for upsert)
CREATE POLICY "Users update own ID docs" ON storage.objects FOR UPDATE
  USING (bucket_id = 'id-verifications' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'id-verifications' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add DELETE policy so users can re-submit
CREATE POLICY "Users delete own ID docs" ON storage.objects FOR DELETE
  USING (bucket_id = 'id-verifications' AND auth.uid()::text = (storage.foldername(name))[1]);
