-- Create the item-photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('item-photos', 'item-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'item-photos');

-- Allow public reads
CREATE POLICY "Allow public reads on item-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'item-photos');

-- Allow owners to delete their own photos
CREATE POLICY "Allow owners to delete photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'item-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
