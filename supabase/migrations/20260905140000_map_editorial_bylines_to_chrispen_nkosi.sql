-- Follow-up to 20260905130000: map the remaining author_id-less articles.
-- The auto-match in that migration only caught exact author_name == profiles.full_name
-- matches, so it skipped every composite/house byline. A review of the
-- unmatched author_name values (grouped, with counts) showed 10 distinct
-- strings that are all the same editorial voice — Chrispen Nkosi, editor of
-- Ground View News / Continental View — differing only in punctuation and
-- whether the institutional name or his own name is used. Confirmed against
-- profiles (id 510f8a8c-21f8-45cb-95ed-47881c34900b, stanleynyadzayo@icloud.com,
-- full_name/pen_name "Chrispen Nkosi") before writing this.
--
-- Linking author_id feeds into remuneration and Founding Lead Editor
-- eligibility calculations (app/api/journalist/remuneration/route.ts,
-- app/api/cron/calculate-revenue/route.ts, lib/founding-lead-editor-program.ts)
-- — this was a deliberate decision to attribute all 10 variants to him,
-- not an automatic default.

UPDATE public.articles
SET author_id = '510f8a8c-21f8-45cb-95ed-47881c34900b',
    author_email = 'stanleynyadzayo@icloud.com'
WHERE author_id IS NULL
  AND trim(author_name) IN (
    'Chrispen Nkosi, The Editor, Continental View | Ground View News',
    'Ground View Editor',
    'The Editor, Continental View | Ground View News',
    'Ground View News | Continental View',
    'Chrispen Nkosi | Ground View Editor',
    'By Chrispen Nkosi, The Editor, Continental View | Ground View News',
    'Chrispen Nkosi, The Editor',
    'Chrispen Nkosi  Ground View Editor',
    'Chrispen Nkosi, Continental View | Ground View News',
    'Chrispen Nkosi, The Editor | Ground View News'
  );

DO $$
DECLARE
  still_unmatched integer;
BEGIN
  SELECT count(*) INTO still_unmatched FROM public.articles WHERE author_id IS NULL;
  RAISE NOTICE 'articles still missing author_id after this mapping: %', still_unmatched;
END $$;
