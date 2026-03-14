-- Add needs_mover flag to items
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS needs_mover BOOLEAN DEFAULT FALSE;

-- Helper requests table — when a matched large item needs a volunteer mover
CREATE TABLE IF NOT EXISTS public.helper_requests (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  helper_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'completed', 'cancelled')),
  conversation_id BIGINT REFERENCES public.conversations(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_helper_requests_status ON public.helper_requests(status);
CREATE INDEX idx_helper_requests_item ON public.helper_requests(item_id);

ALTER TABLE public.helper_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view open helper requests"
  ON public.helper_requests FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create helper requests"
  ON public.helper_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Participants can update helper requests"
  ON public.helper_requests FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = helper_id);

-- Qualifications / certificates table
CREATE TABLE IF NOT EXISTS public.qualifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('trade', 'professional', 'first_aid', 'licence', 'reference', 'other')),
  document_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qualifications_user ON public.qualifications(user_id);
CREATE INDEX idx_qualifications_status ON public.qualifications(status);

ALTER TABLE public.qualifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own qualifications"
  ON public.qualifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view verified qualifications"
  ON public.qualifications FOR SELECT
  USING (status = 'verified');

CREATE POLICY "Users can insert own qualifications"
  ON public.qualifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update qualifications"
  ON public.qualifications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Private storage bucket for qualification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('qualifications', 'qualifications', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload their own docs
CREATE POLICY "Users upload own qualification docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'qualifications' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage RLS: admins can view all qualification docs
CREATE POLICY "Admins view qualification docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'qualifications' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- Storage RLS: users can view their own docs
CREATE POLICY "Users view own qualification docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'qualifications' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Add mover_count to profiles for tracking "Mover" badge
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mover_count INTEGER DEFAULT 0;
