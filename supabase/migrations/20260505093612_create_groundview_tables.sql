/*
  # Ground View News — Initial Schema

  1. New Tables
    - `articles`
      - `id` (uuid, primary key)
      - `title` (text)
      - `subtitle` (text)
      - `slug` (text, unique)
      - `author_name` (text)
      - `category` (text) — one of: africa-diaspora, world-politics, human-rights, economy, commentary
      - `label` (text) — short display label
      - `body` (jsonb) — rich text content as JSON
      - `excerpt` (text)
      - `featured_image_url` (text)
      - `status` (text) — 'draft' or 'published'
      - `published_at` (timestamptz)
      - `created_at` (timestamptz)

    - `subscribers`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `confirmed` (boolean, default false)
      - `created_at` (timestamptz)

    - `contact_messages`
      - `id` (uuid, primary key)
      - `name` (text)
      - `email` (text)
      - `subject` (text)
      - `message` (text)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Public SELECT on published articles
    - Authenticated INSERT for subscribers and contact_messages (anon key allowed via policy)
*/

CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  subtitle text DEFAULT '',
  slug text UNIQUE NOT NULL,
  author_name text DEFAULT '',
  category text DEFAULT '',
  label text DEFAULT '',
  body jsonb DEFAULT '{}',
  excerpt text DEFAULT '',
  featured_image_url text DEFAULT '',
  status text DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published articles"
  ON articles FOR SELECT
  USING (status = 'published');

CREATE TABLE IF NOT EXISTS subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe"
  ON subscribers FOR INSERT
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  subject text DEFAULT '',
  message text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact message"
  ON contact_messages FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS articles_status_published_at_idx ON articles (status, published_at DESC);
CREATE INDEX IF NOT EXISTS articles_category_idx ON articles (category);
CREATE INDEX IF NOT EXISTS articles_slug_idx ON articles (slug);
