-- Editorial feedback rounds on writer articles. An editor sends comments (for
-- example "add sources"), the article goes back to the writer as an editable
-- draft, and the snapshot taken here lets us show the editor exactly what
-- changed when the writer resubmits. Once any round exists for an article it
-- always goes through human editorial review, never automated publishing.

CREATE TABLE IF NOT EXISTS public.article_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  round integer NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  snapshot jsonb NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  email_sent boolean NOT NULL DEFAULT false,
  resubmitted_at timestamptz,
  resubmission_summary jsonb,
  UNIQUE (article_id, round)
);

CREATE INDEX IF NOT EXISTS article_feedback_article_idx
  ON public.article_feedback (article_id, round DESC);

ALTER TABLE public.article_feedback ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: read and written only by server code using
-- the service role (admin request-changes route, article GET/PATCH routes).
COMMENT ON TABLE public.article_feedback IS
  'Editor feedback rounds on writer articles. snapshot = {title, subtitle, excerpt, markdown} at the time feedback was sent; resubmitted_at is set when the writer resubmits, with a diff summary in resubmission_summary. Service-role access only.';
