-- Writer onboarding system: extra profile fields, ready-to-publish article state, and writer feedback

-- 1) Additional profile columns for writer applications
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS country text;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS how_heard_about text;

COMMENT ON COLUMN public.profiles.phone IS 'Writer phone number (with country code), captured at application time.';
COMMENT ON COLUMN public.profiles.country IS 'Writer country/region of residence.';
COMMENT ON COLUMN public.profiles.how_heard_about IS 'Optional acquisition channel from writer application form.';

-- 2) Writer feedback table
CREATE TABLE IF NOT EXISTS public.writer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  writer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writer_feedback_writer_id ON public.writer_feedback(writer_id);
CREATE INDEX IF NOT EXISTS idx_writer_feedback_created_at ON public.writer_feedback(created_at DESC);

ALTER TABLE public.writer_feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Writers can insert own feedback'
      AND tablename = 'writer_feedback'
  ) THEN
    CREATE POLICY "Writers can insert own feedback" ON public.writer_feedback
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = writer_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Writers can read own feedback'
      AND tablename = 'writer_feedback'
  ) THEN
    CREATE POLICY "Writers can read own feedback" ON public.writer_feedback
      FOR SELECT TO authenticated
      USING (auth.uid() = writer_id);
  END IF;
END $$;

COMMENT ON TABLE public.writer_feedback IS 'Logged-in writer feedback submissions (subject, message, 1–5 star rating).';

-- 3) Article ready-to-publish state — articles.status is freeform text, so no constraint update is needed.
--    Document the new value so future contributors know it's valid.
COMMENT ON COLUMN public.articles.status IS
  'Article workflow status. Known values: draft, pending, pending_editorial, approved_pending_publish, published, rejected, quarantined.';
