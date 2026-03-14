-- Create profile-photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('profile-photos', 'profile-photos', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload profile photos
CREATE POLICY "Users can upload profile photos" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'profile-photos');

-- Allow public read access to profile photos
CREATE POLICY "Public can view profile photos" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'profile-photos');

-- Allow users to update/replace their profile photo
CREATE POLICY "Users can update profile photos" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'profile-photos');
