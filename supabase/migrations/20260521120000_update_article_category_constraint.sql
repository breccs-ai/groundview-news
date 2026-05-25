-- Update articles_category_check to cover the full 15-category slug set
-- plus the legacy slugs ('economy', 'commentary') used by already-published
-- articles. Keeping the legacy slugs guarantees zero data migration is needed
-- on existing rows.

-- 1) Drop the old constraint if it still exists.
ALTER TABLE public.articles
  DROP CONSTRAINT IF EXISTS articles_category_check;

-- 2) Re-add the constraint with the full slug list. Wrapped in a DO block so
-- the migration stays idempotent and can be re-run safely.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'articles_category_check'
      AND conrelid = 'public.articles'::regclass
  ) THEN
    ALTER TABLE public.articles
      ADD CONSTRAINT articles_category_check CHECK (
        category IN (
          -- Current 15 category slugs (writer-facing)
          'world-politics',
          'business-economy',
          'financial-news-banking',
          'sports',
          'africa-diaspora',
          'science-technology',
          'culture-society',
          'human-interest',
          'environment-climate',
          'health-medicine',
          'law-justice',
          'education',
          'travel-migration',
          'opinion-commentary',
          'human-rights',
          -- Legacy slugs retained so existing published articles still validate
          'economy',
          'commentary'
        )
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT articles_category_check ON public.articles IS
  'Allowed article category slugs. Includes the 15 current writer-facing categories plus the legacy slugs (economy, commentary) so already-published articles remain valid.';
