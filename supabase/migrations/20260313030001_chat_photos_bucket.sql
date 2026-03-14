-- Create chat-photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-photos', 'chat-photos', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload chat photos
CREATE POLICY "Users can upload chat photos" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'chat-photos');

-- Allow public read access to chat photos
CREATE POLICY "Public can view chat photos" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'chat-photos');
