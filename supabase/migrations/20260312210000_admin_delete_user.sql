-- First, create any missing tables referenced by the schema that haven't been migrated yet
CREATE TABLE IF NOT EXISTS public.matches (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  item_id BIGINT REFERENCES public.items(id),
  giver_id UUID REFERENCES public.profiles(id),
  receiver_id UUID REFERENCES public.profiles(id),
  status TEXT CHECK (status IN ('pending','accepted','declined','completed','cancelled')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  match_id BIGINT REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  other_user_id UUID REFERENCES public.profiles(id),
  item_id BIGINT REFERENCES public.items(id),
  blocked_by UUID,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  conversation_id BIGINT REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  content TEXT,
  scam_flagged BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT,
  title TEXT,
  body TEXT,
  item_id BIGINT,
  match_id BIGINT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reliability (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.profiles(id),
  completed BOOLEAN,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  tags TEXT[],
  no_show_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(id),
  category TEXT,
  details TEXT,
  item_id BIGINT,
  conversation_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reliability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS policies (using IF NOT EXISTS pattern via DO blocks)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'Users can view own matches') THEN
    CREATE POLICY "Users can view own matches" ON public.matches FOR SELECT USING (giver_id = auth.uid() OR receiver_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'Users can create matches') THEN
    CREATE POLICY "Users can create matches" ON public.matches FOR INSERT WITH CHECK (giver_id = auth.uid() OR receiver_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'Users can update own matches') THEN
    CREATE POLICY "Users can update own matches" ON public.matches FOR UPDATE USING (giver_id = auth.uid() OR receiver_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Users can view own conversations') THEN
    CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT USING (user_id = auth.uid() OR other_user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Users can create conversations') THEN
    CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Users can update own conversations') THEN
    CREATE POLICY "Users can update own conversations" ON public.conversations FOR UPDATE USING (user_id = auth.uid() OR other_user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can view own messages') THEN
    CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (
      sender_id = auth.uid() OR conversation_id IN (
        SELECT id FROM public.conversations WHERE user_id = auth.uid() OR other_user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can send messages') THEN
    CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view own notifications') THEN
    CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can update own notifications') THEN
    CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reliability' AND policyname = 'Users can view own reliability') THEN
    CREATE POLICY "Users can view own reliability" ON public.reliability FOR SELECT USING (user_id = auth.uid() OR partner_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reliability' AND policyname = 'Users can insert reliability') THEN
    CREATE POLICY "Users can insert reliability" ON public.reliability FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Users can create reports') THEN
    CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
  END IF;
END $$;

-- Admin function to fully delete a user and all their data
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin BOOLEAN;
BEGIN
  -- Check the caller is an admin
  SELECT is_admin INTO caller_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Prevent deleting yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account via admin panel';
  END IF;

  -- Delete from all user-related tables
  DELETE FROM public.helper_requests WHERE requester_id = target_user_id OR helper_id = target_user_id;
  DELETE FROM public.qualifications WHERE user_id = target_user_id;
  DELETE FROM public.id_verifications WHERE user_id = target_user_id;
  DELETE FROM public.points_log WHERE user_id = target_user_id;
  DELETE FROM public.reports WHERE reporter_id = target_user_id OR reported_user_id = target_user_id;
  DELETE FROM public.reliability WHERE user_id = target_user_id OR partner_id = target_user_id;
  DELETE FROM public.notifications WHERE user_id = target_user_id;

  -- Delete messages in user's conversations
  DELETE FROM public.messages WHERE conversation_id IN (
    SELECT id FROM public.conversations WHERE user_id = target_user_id OR other_user_id = target_user_id
  );
  DELETE FROM public.conversations WHERE user_id = target_user_id OR other_user_id = target_user_id;

  -- Delete matches involving the user
  DELETE FROM public.matches WHERE giver_id = target_user_id OR receiver_id = target_user_id;

  -- Delete item photos, then items
  DELETE FROM public.item_photos WHERE item_id IN (
    SELECT id FROM public.items WHERE user_id = target_user_id
  );
  DELETE FROM public.items WHERE user_id = target_user_id;

  -- Delete profile
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Delete auth user (requires SECURITY DEFINER to access auth schema)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
