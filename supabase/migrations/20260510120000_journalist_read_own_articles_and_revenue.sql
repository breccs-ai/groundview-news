-- Allow authenticated journalists to read their own article rows (any status) for the portal.
-- The public policy only exposes published articles; this adds author-scoped access.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Journalists can read own articles' AND tablename = 'articles') THEN
    CREATE POLICY "Journalists can read own articles" ON articles FOR SELECT TO authenticated USING (author_id IS NOT NULL AND author_id = auth.uid());
  END IF;
END $$;
