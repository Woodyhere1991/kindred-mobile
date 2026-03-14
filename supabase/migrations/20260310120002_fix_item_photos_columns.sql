-- Add missing columns to match code expectations
ALTER TABLE item_photos ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE item_photos ADD COLUMN IF NOT EXISTS public_url text;
ALTER TABLE item_photos ADD COLUMN IF NOT EXISTS position int DEFAULT 0;
