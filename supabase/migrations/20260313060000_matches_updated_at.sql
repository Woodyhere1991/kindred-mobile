-- Add updated_at column to matches table to track when status changes
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Set existing rows' updated_at to created_at
UPDATE public.matches SET updated_at = created_at WHERE updated_at IS NULL;

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS matches_updated_at_trigger ON public.matches;
CREATE TRIGGER matches_updated_at_trigger
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION update_matches_updated_at();
