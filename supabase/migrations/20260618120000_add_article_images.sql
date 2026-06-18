-- Also apply this migration in the Supabase Dashboard SQL Editor before deploying the UI.
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS article_images jsonb DEFAULT '[]'::jsonb;
