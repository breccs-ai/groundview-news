/*
  # Advertiser and Journalist Portal Tables

  ## New Tables

  ### profiles
  - `id` (uuid, PK, references auth.users)
  - `email` (text)
  - `full_name` (text)
  - `role` (text): 'advertiser' | 'journalist' | 'admin'
  - `bio` (text, nullable) — for journalists
  - `pen_name` (text, nullable) — for journalists
  - `subscription_tier` (text, nullable): 'starter' | 'standard' | 'professional'
  - `stripe_customer_id` (text, nullable)
  - `stripe_subscription_id` (text, nullable)
  - `articles_used_this_month` (int, default 0)
  - `created_at` (timestamptz)

  ### advertisements
  - `id` (uuid, PK)
  - `advertiser_id` (uuid): initially references profiles(id) for bootstrap; migration 20260514140000 repoints ownership to advertiser_profiles(id). RLS for advertisements is defined there (EXISTS … ap.user_id = auth.uid()).
  - `company_name` (text)
  - `title` (text, max 60 chars enforced at app level)
  - `copy` (text, max 150 chars enforced at app level)
  - `destination_url` (text)
  - `image_url` (text, nullable)
  - `video_url` (text, nullable)
  - `package_days` (int): 7, 14, 30, 60, 90
  - `package_price_pence` (int): price in pence
  - `status` (text): draft | pending_review | approved | active | rejected | expired | discarded
  - `rejection_reason` (text, nullable)
  - `stripe_session_id` (text, nullable)
  - `stripe_payment_intent_id` (text, nullable)
  - `starts_at` (timestamptz, nullable)
  - `ends_at` (timestamptz, nullable)
  - `impressions` (int, default 0)
  - `reminder_sent_at` (timestamptz, nullable) — for 72hr draft reminder
  - `final_reminder_sent_at` (timestamptz, nullable) — for 120hr final reminder
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Users can only read/write their own rows
  - Service role key bypasses RLS for admin and cron operations
*/

-- profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'advertiser',
  bio text,
  pen_name text,
  subscription_tier text,
  stripe_customer_id text,
  stripe_subscription_id text,
  articles_used_this_month int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users can read own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile' AND tablename = 'profiles') THEN
    CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- advertisements table
CREATE TABLE IF NOT EXISTS advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  copy text NOT NULL DEFAULT '',
  destination_url text NOT NULL DEFAULT '',
  image_url text,
  video_url text,
  package_days int NOT NULL DEFAULT 30,
  package_price_pence int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  rejection_reason text,
  stripe_session_id text,
  stripe_payment_intent_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  impressions int NOT NULL DEFAULT 0,
  reminder_sent_at timestamptz,
  final_reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- Authenticated RLS policies for advertisements live in 20260514140000_advertiser_system_v2.sql
-- (after advertiser_profiles exists). Using auth.uid() = advertiser_id here would be wrong once
-- advertiser_id references advertiser_profiles(id) instead of profiles/auth uid.

-- Index for cron queries
CREATE INDEX IF NOT EXISTS idx_advertisements_status ON advertisements(status);
CREATE INDEX IF NOT EXISTS idx_advertisements_updated_at ON advertisements(updated_at);
CREATE INDEX IF NOT EXISTS idx_advertisements_ends_at ON advertisements(ends_at);
CREATE INDEX IF NOT EXISTS idx_advertisements_advertiser_id ON advertisements(advertiser_id);
