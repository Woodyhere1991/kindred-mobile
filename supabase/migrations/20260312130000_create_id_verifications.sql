-- Create private storage bucket for ID documents
INSERT INTO storage.buckets (id, name, public) VALUES ('id-verifications', 'id-verifications', false)
ON CONFLICT DO NOTHING;

-- RLS: users can upload to their own folder
CREATE POLICY "Users upload own ID docs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'id-verifications' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can view all ID docs
CREATE POLICY "Admins view ID docs" ON storage.objects FOR SELECT
  USING (bucket_id = 'id-verifications' AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ));

-- ID verifications table
CREATE TABLE IF NOT EXISTS public.id_verifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  document_type TEXT NOT NULL,
  id_photo_path TEXT NOT NULL,
  selfie_path TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.id_verifications ENABLE ROW LEVEL SECURITY;

-- Users can see their own verification status
CREATE POLICY "Users see own verification" ON public.id_verifications FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own verification
CREATE POLICY "Users submit verification" ON public.id_verifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can view and update all verifications
CREATE POLICY "Admins manage verifications" ON public.id_verifications FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
