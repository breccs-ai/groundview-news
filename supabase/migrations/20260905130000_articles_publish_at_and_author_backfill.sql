-- Backfill and tighten articles.publish_at / author_id / author_email, and drop
-- an orphaned column on article_views that no app code has ever read or written.
--
-- Context: author_id/author_email were added in 20260509120000 but only ever
-- required for journalist-submitted articles (app/api/articles/route.ts). Admin/
-- editorial-imported articles were never required to have one, which is why so
-- many rows carry only a free-text author_name. This migration auto-matches the
-- unambiguous cases (author_name exactly matches an existing profiles.full_name)
-- and reports what's left for a human to map by hand — it does not invent an
-- author for content nobody has actually attributed to a real account.

-- 1. Backfill publish_at for published articles that predate the column, using
--    the same formula the app applies live (see applyEarlyAccessPublishAt in
--    app/api/articles/route.ts): publish_at = published_at + 24h.
UPDATE public.articles
SET publish_at = COALESCE(published_at, created_at) + interval '24 hours'
WHERE status = 'published'
  AND publish_at IS NULL;

-- 2. Enforce it going forward — published articles only. Draft/pending articles
--    legitimately have no publish date yet, so they're intentionally exempt.
ALTER TABLE public.articles
  ADD CONSTRAINT articles_publish_at_required_when_published
  CHECK (status IS DISTINCT FROM 'published' OR publish_at IS NOT NULL);

-- 3. Auto-match author_id/author_email only where author_name is an exact,
--    unambiguous match against an existing profile. Deliberately conservative:
--    composite bylines like "Chrispen Nkosi, Continental View | Ground View
--    News" won't match anything and are left for a human decision.
UPDATE public.articles a
SET author_id = p.id,
    author_email = COALESCE(NULLIF(p.email, ''), a.author_email)
FROM public.profiles p
WHERE a.author_id IS NULL
  AND a.author_name IS NOT NULL
  AND trim(a.author_name) <> ''
  AND trim(p.full_name) <> ''
  AND lower(trim(a.author_name)) = lower(trim(p.full_name));

-- 4. Report what's left so the remaining mapping can be done deliberately,
--    rather than guessed at here. Shows up in the SQL editor / CLI output
--    when this migration is applied.
DO $$
DECLARE
  rec RECORD;
  total_unmatched integer;
BEGIN
  SELECT count(*) INTO total_unmatched FROM public.articles WHERE author_id IS NULL;
  RAISE NOTICE 'articles still missing author_id after auto-match: %', total_unmatched;
  FOR rec IN
    SELECT author_name, count(*) AS article_count
    FROM public.articles
    WHERE author_id IS NULL
    GROUP BY author_name
    ORDER BY article_count DESC
  LOOP
    RAISE NOTICE '  % article(s) - author_name: %', rec.article_count, rec.author_name;
  END LOOP;
END $$;

-- 5. article_views.author_id is not referenced anywhere in this codebase —
--    every insert/select path uses journalist_id instead (see
--    app/api/articles/[slug]/view/route.ts, app/api/articles/view/route.ts,
--    lib/article-metrics.ts, app/api/admin/metrics/route.ts). It was never
--    created by a tracked migration either, so it's schema drift with nothing
--    behind it. Dropping it; journalist_id remains the real column.
ALTER TABLE public.article_views DROP COLUMN IF EXISTS author_id;
