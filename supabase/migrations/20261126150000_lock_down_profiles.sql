-- Applied 26 Nov 2026.
--
-- Any signed-in user can edit their own profiles row, including the columns that decide
-- what they are allowed to do. Tested live on 26 Nov 2026 with a disposable user
-- (since deleted), signed in with the public anon key, each change accepted:
--   role -> admin, subscription_status -> active, subscription_tier -> featured,
--   application_status -> approved, articles_limit -> 9999, roles -> {admin},
--   stripe_customer_id -> anything.
-- A user could also INSERT their own profiles row with any values.
--
-- Why it matters: lib/articles-api-auth.ts treats a profile with role/roles containing
-- 'journalist' and subscription_status = 'active' as an approved writer. A self-made account
-- could therefore skip the writer approval and ID check and publish through the articles API,
-- and set itself up as a paid member or advertiser.
--
-- Fix: browsers never need to write profiles. Every write in the site goes through server
-- routes using the service role (checked: app/api/journalist/register, advertiser/register,
-- advertiser/bootstrap-profile, writer/apply, admin/journalists/decision,
-- journalist/application-reviews, journalists/unsubscribe-reminders, subscribe/success,
-- webhooks/stripe), which bypass RLS and grants. So remove the browser write paths.
-- "Users can read own profile" is kept.

BEGIN;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.profiles FROM anon, authenticated;
REVOKE REFERENCES, TRIGGER ON public.profiles FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
