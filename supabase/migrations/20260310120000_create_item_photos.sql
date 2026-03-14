CREATE TABLE IF NOT EXISTS item_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id bigint REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE item_photos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view item photos' AND tablename = 'item_photos') THEN
    CREATE POLICY "Anyone can view item photos" ON item_photos FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can manage item photos' AND tablename = 'item_photos') THEN
    CREATE POLICY "Owners can manage item photos" ON item_photos FOR ALL USING (item_id IN (SELECT id FROM items WHERE user_id = auth.uid()));
  END IF;
END $$;
