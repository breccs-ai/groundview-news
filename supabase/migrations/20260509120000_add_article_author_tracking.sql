-- Journalist attribution and notification email for automated review flows
ALTER TABLE IF EXISTS articles
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES profiles (id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS articles
  ADD COLUMN IF NOT EXISTS author_email text;
