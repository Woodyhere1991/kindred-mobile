-- Fix item_photos: drop NOT NULL on unused photo_url, add NOT NULL on correct columns
ALTER TABLE item_photos ALTER COLUMN photo_url DROP NOT NULL;
ALTER TABLE item_photos ALTER COLUMN storage_path SET NOT NULL;
ALTER TABLE item_photos ALTER COLUMN public_url SET NOT NULL;
