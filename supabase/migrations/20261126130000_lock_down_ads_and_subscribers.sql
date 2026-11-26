-- Applied 26 Nov 2026.
--
-- Two row-level-security holes found on 26 Nov 2026. The anon key is public (it ships
-- in the browser bundle), so anything the anon role may do, anyone on the internet may do.
--
-- 1. subscribers: the policy "Anyone can subscribe with valid email" lets anyone insert a
--    row with only an email address. It is OR-ed with the stricter "required fields"
--    policy, so the strict one protects nothing. Tested live with a disposable row: an
--    anonymous insert with confirmed = true was ACCEPTED. That bypasses the form's
--    honeypot, rate limit, name checks and the new double opt-in, and the weekly digest
--    would then email that address.
--
-- 2. advertisements: "Advertisers can manage own ads" is FOR ALL, TO public,
--    USING (true) WITH CHECK (true). Anyone can read, change or delete every ad, for
--    example point a live ad at a malicious destination_url or create an active ad.
--
-- Every write to these tables in the site's code goes through server routes using the
-- service role (checked: app/api/newsletter*, app/api/cron/*, app/api/admin/*,
-- app/api/advertiser/*, lib/advertiser/active-ads.ts), and the service role bypasses RLS,
-- so removing the anonymous write paths does not affect the website.
--
-- What stays: "Public can read active ads" (reading active ads), and the three
-- advertiser_profiles-based policies that let a signed-in advertiser read, insert and
-- update only their own ads.

BEGIN;

-- subscribers: no direct writes from browsers at all.
DROP POLICY IF EXISTS "Anyone can subscribe with valid email" ON public.subscribers;
DROP POLICY IF EXISTS "Anyone can subscribe with required fields" ON public.subscribers;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.subscribers FROM anon, authenticated;

-- advertisements: remove the open policy; keep per-advertiser policies.
DROP POLICY IF EXISTS "Advertisers can manage own ads" ON public.advertisements;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.advertisements FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.advertisements FROM anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
