-- SECURITY FIX: lock down the articles table.
--
-- Earlier migrations let the public "anon" database key (which ships inside the
-- website's own JavaScript) read every article including unpublished drafts,
-- and create, change and delete any article, relying on an admin cookie check
-- in the app as the only protection. That cookie was forgeable, and even a
-- signed cookie would not have stopped anyone using the public key directly.
--
-- After this migration:
--   * anyone (anon or signed-in) can read PUBLISHED articles only;
--   * a signed-in writer can additionally read their own articles;
--   * nobody using the public key can create, change or delete articles.
-- All writes go through server routes using the service role (which bypasses
-- these rules), behind the signed admin session or a verified writer token.
--
-- ORDER OF DEPLOYMENT: apply this only AFTER the matching code is live. The
-- previous admin dashboard wrote to this table directly with the public key and
-- would stop working the moment this is applied.
--
-- ROLLBACK (if something unexpected breaks), run in the SQL editor:
--   DROP POLICY IF EXISTS "Public can read published articles" ON public.articles;
--   DROP POLICY IF EXISTS "Writers can read own articles" ON public.articles;
--   GRANT INSERT, UPDATE, DELETE ON public.articles TO anon, authenticated;
--   CREATE POLICY "Anyone can read published articles" ON public.articles FOR SELECT USING (status = 'published');
--   (then restore whichever write policies you need)

-- Drop every existing policy on the table, whatever it is called, so nothing
-- unknown can keep granting access.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'articles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.articles', p.policyname);
  END LOOP;
END $$;

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published articles"
  ON public.articles FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Writers can read own articles"
  ON public.articles FOR SELECT
  TO authenticated
  USING (author_id IS NOT NULL AND author_id = auth.uid());

-- Belt and braces: remove the write privileges themselves from the public roles.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.articles FROM anon, authenticated;

COMMENT ON TABLE public.articles IS
  'Public site content. anon/authenticated may only SELECT (published, or own for writers). All writes use the service role via server routes.';
