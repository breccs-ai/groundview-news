-- Fixes a broken CHECK constraint on articles.status that was added directly
-- in the Supabase dashboard at some point after 20260520190000_writer_onboarding_system.sql
-- (which explicitly noted "articles.status is freeform text, so no constraint
-- update is needed" and documented the 7 known values by convention only).
-- That undocumented constraint is missing 'approved_pending_publish', which
-- is exactly the status app/api/admin/articles/approve-for-publish/route.ts
-- writes when an admin clicks Approve on an article in review — causing:
--   new row for relation "articles" violates check constraint "articles_status_check"
--
-- Replaces it with a constraint matching the documented set exactly, now
-- tracked in migration history so it can't silently drift again.
ALTER TABLE public.articles
  DROP CONSTRAINT IF EXISTS articles_status_check;

ALTER TABLE public.articles
  ADD CONSTRAINT articles_status_check
  CHECK (status IN (
    'draft',
    'pending',
    'pending_editorial',
    'approved_pending_publish',
    'published',
    'rejected',
    'quarantined'
  ));
