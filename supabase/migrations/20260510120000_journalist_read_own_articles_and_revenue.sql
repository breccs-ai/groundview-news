-- Allow authenticated journalists to read their own article rows (any status) for the portal.
-- The public policy only exposes published articles; this adds author-scoped access.

CREATE POLICY "Journalists can read own articles"
  ON articles FOR SELECT
  TO authenticated
  USING (author_id IS NOT NULL AND author_id = auth.uid());
