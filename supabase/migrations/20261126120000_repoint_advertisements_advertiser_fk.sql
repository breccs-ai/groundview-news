-- advertisements.advertiser_id has to reference advertiser_profiles(id).
--
-- Migration 20260514140000 meant to repoint it, but it used
--   ADD COLUMN IF NOT EXISTS advertiser_id ... REFERENCES advertiser_profiles(id)
-- and the column already existed (created in 20260506040214 as a reference to
-- profiles(id)), so the statement did nothing and the old constraint stayed.
--
-- Effects of the stale constraint:
--   * every route that creates an ad stores an advertiser_profiles id, which the
--     old constraint rejects, so ad creation (including after checkout) fails;
--   * the admin ads panel embeds advertiser_profiles(...) on advertisements,
--     which PostgREST cannot resolve, so the panel shows no ads.
--
-- Checked before writing this: advertisements has 0 rows and advertiser_profiles
-- has 0 rows, so there is nothing to repair and the new constraint cannot be
-- violated. The whole change runs in one transaction; if anything fails it rolls back.

BEGIN;

ALTER TABLE public.advertisements
  DROP CONSTRAINT IF EXISTS advertisements_advertiser_id_fkey;

ALTER TABLE public.advertisements
  ADD CONSTRAINT advertisements_advertiser_id_fkey
  FOREIGN KEY (advertiser_id) REFERENCES public.advertiser_profiles(id) ON DELETE CASCADE;

-- Make PostgREST pick up the new relationship straight away.
NOTIFY pgrst, 'reload schema';

COMMIT;
