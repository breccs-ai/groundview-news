-- Adds `publish_at` to articles for the 24-hour subscriber early-access window.
--
-- Semantics:
--   * NULL              → article is universally visible (legacy behaviour).
--   * publish_at <= now → article is universally visible (window has passed).
--   * publish_at >  now → article is universally accessible, but the public
--                          article page renders a soft "Subscribers are reading
--                          this now" banner for non-subscribers. Subscribers
--                          see no banner.
--
-- We never gate article fetch on publish_at — readers are never blocked.

ALTER TABLE IF EXISTS public.articles
  ADD COLUMN IF NOT EXISTS publish_at timestamptz;

-- Partial index for the cron / banner check: small footprint, only indexes
-- rows still inside an active early-access window.
CREATE INDEX IF NOT EXISTS idx_articles_publish_at
  ON public.articles (publish_at)
  WHERE publish_at IS NOT NULL;
