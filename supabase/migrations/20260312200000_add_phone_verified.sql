-- Add phone_verified column to profiles for SMS OTP verification tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
