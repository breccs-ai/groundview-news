-- Article view/share counters and RPC helpers (idempotent)

ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS shares jsonb NOT NULL DEFAULT '{"twitter":0,"facebook":0,"linkedin":0,"whatsapp":0,"total":0}'::jsonb;

CREATE OR REPLACE FUNCTION public.increment_article_views(article_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.articles
  SET views = COALESCE(views, 0) + 1
  WHERE slug = article_slug AND status = 'published';
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_article_shares(article_slug text, platform_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.articles
  SET shares = jsonb_set(
    jsonb_set(
      COALESCE(shares, '{"twitter":0,"facebook":0,"linkedin":0,"whatsapp":0,"total":0}'::jsonb),
      ARRAY[platform_name],
      to_jsonb(COALESCE((shares->>platform_name)::integer, 0) + 1),
      true
    ),
    ARRAY['total'],
    to_jsonb(COALESCE((shares->>'total')::integer, 0) + 1),
    true
  )
  WHERE slug = article_slug AND status = 'published';
END;
$$;
