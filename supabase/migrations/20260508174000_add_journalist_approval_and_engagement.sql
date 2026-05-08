-- Adds journalist approval fields and engagement tracking columns (safe if already present)

ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'pending_approval';

ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS expertise text[] NOT NULL DEFAULT '{}';

ALTER TABLE IF EXISTS profiles
  ALTER COLUMN subscription_tier SET DEFAULT 'free';

ALTER TABLE IF EXISTS article_views
  ADD COLUMN IF NOT EXISTS session_id text;

ALTER TABLE IF EXISTS article_views
  ADD COLUMN IF NOT EXISTS time_on_page_seconds numeric;

ALTER TABLE IF EXISTS article_views
  ADD COLUMN IF NOT EXISTS scroll_depth_percent numeric;

ALTER TABLE IF EXISTS article_views
  ADD COLUMN IF NOT EXISTS referrer text;

ALTER TABLE IF EXISTS article_views
  ADD COLUMN IF NOT EXISTS engagement_score numeric;

