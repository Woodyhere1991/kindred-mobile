-- Store the user's home address securely for meetup sharing
-- Address is private and only shared when the user explicitly chooses to

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_address TEXT;

-- RLS already enforces that users can only read/update their own profile
-- so home_address is protected by existing row-level security
