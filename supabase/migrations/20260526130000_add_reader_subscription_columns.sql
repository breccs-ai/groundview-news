-- Reader subscription columns on profiles.
--
-- The profiles table already has:
--   * subscription_status text NOT NULL DEFAULT 'pending_approval'   (journalist legacy)
--   * subscription_tier text                                          (journalist legacy)
--   * stripe_customer_id text
--   * stripe_subscription_id text
--
-- This migration adds the reader-subscription columns the new /subscribe flow
-- needs, and changes the default for newly-created profiles to 'free' so that
-- readers who land on /subscribe before signing up are treated as free readers
-- the moment their profile row is provisioned. Existing rows (journalists
-- still mid-approval) are deliberately left untouched.

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS subscription_plan text;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

-- Default flip for new reader rows. Does not back-fill existing rows so it
-- cannot accidentally promote a journalist from 'pending_approval' to 'free'.
ALTER TABLE IF EXISTS public.profiles
  ALTER COLUMN subscription_status SET DEFAULT 'free';

-- Index the lookups the admin Subscribers page + cron newsletter perform:
--   "all paying readers" and "subscribers whose expiry is in the past".
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status
  ON public.profiles (subscription_status);

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_expires_at
  ON public.profiles (subscription_expires_at)
  WHERE subscription_expires_at IS NOT NULL;
