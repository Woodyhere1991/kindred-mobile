-- Allow any authenticated user to create notifications (needed for offer/match notifications)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can insert notifications') THEN
    CREATE POLICY "Users can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
  END IF;
END $$;
