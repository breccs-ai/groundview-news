-- Analytics: article_views (row-level) and article_shares (per click events)

CREATE TABLE IF NOT EXISTS public.article_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  journalist_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id text,
  time_on_page_seconds numeric,
  scroll_depth_percent numeric,
  referrer text,
  referrer_source text,
  engagement_score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.article_views ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE public.article_views ADD COLUMN IF NOT EXISTS time_on_page_seconds numeric;
ALTER TABLE public.article_views ADD COLUMN IF NOT EXISTS scroll_depth_percent numeric;
ALTER TABLE public.article_views ADD COLUMN IF NOT EXISTS referrer text;
ALTER TABLE public.article_views ADD COLUMN IF NOT EXISTS referrer_source text;
ALTER TABLE public.article_views ADD COLUMN IF NOT EXISTS engagement_score numeric;
ALTER TABLE public.article_views ADD COLUMN IF NOT EXISTS journalist_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.article_views ADD COLUMN IF NOT EXISTS article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE;
ALTER TABLE public.article_views ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_article_views_article_id ON public.article_views(article_id);
CREATE INDEX IF NOT EXISTS idx_article_views_session_id ON public.article_views(session_id);
CREATE INDEX IF NOT EXISTS idx_article_views_created_at ON public.article_views(created_at);
CREATE INDEX IF NOT EXISTS idx_article_views_referrer_source ON public.article_views(referrer_source);

CREATE TABLE IF NOT EXISTS public.article_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  share_channel text NOT NULL,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_article_shares_article_id ON public.article_shares(article_id);
CREATE INDEX IF NOT EXISTS idx_article_shares_channel ON public.article_shares(share_channel);
CREATE INDEX IF NOT EXISTS idx_article_shares_created_at ON public.article_shares(created_at);

COMMENT ON COLUMN public.article_views.referrer_source IS 'Classified traffic source: direct, search, social_*, referral, unknown';
COMMENT ON TABLE public.article_shares IS 'Per-click share button events; share_channel matches platform id';
