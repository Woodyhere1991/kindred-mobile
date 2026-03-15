DO $$
DECLARE
  b RECORD;
BEGIN
  SELECT * INTO b FROM storage.buckets WHERE id = 'id-verifications';
  IF b IS NULL THEN
    RAISE NOTICE 'BUCKET NOT FOUND! Creating it...';
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('id-verifications', 'id-verifications', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']);
    RAISE NOTICE 'Bucket created.';
  ELSE
    RAISE NOTICE 'Bucket found: id=% name=% public=% owner=%', b.id, b.name, b.public, b.owner;
  END IF;
END $$;
