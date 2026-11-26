-- Applied 26 Nov 2026.
--
-- The live advertisements table is still the original v1 shape, while the site's code
-- (admin panel, ad creation, checkout, Stripe webhook, ad display) uses the v2 shape.
-- Migration 20260514140000 was meant to bridge them but most of it was a no-op
-- (ADD COLUMN IF NOT EXISTS on columns that already existed, conditional UPDATEs).
-- The table has 0 rows, so nothing needs migrating; this only reshapes the empty table.
--
-- Differences found (code expects -> live table has):
--   title                  -> ad_title (NOT NULL)            : rename
--   copy                   -> ad_copy                        : rename
--   duration_days          -> NOT NULL, no default           : make optional (v2 uses billing_cycle)
--   status values          -> CHECK allows only pending/active/expired/rejected/quarantined,
--                             code also uses draft, pending_payment, pending_review,
--                             cancelled, discarded                      : widen the check
--   user_id, package_days, package_price_pence, stripe_session_id,
--   reminder_sent_at, final_reminder_sent_at (older routes: /api/advertiser/checkout,
--   /api/advertiser/save-ad, /api/cron/ad-reminders, /dashboard) -> missing: add as nullable
--
-- Without this: the admin ads panel errors, the public ad display query errors, and
-- creating an ad (including after payment) fails.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='advertisements' AND column_name='ad_title')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='advertisements' AND column_name='title') THEN
    ALTER TABLE public.advertisements RENAME COLUMN ad_title TO title;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='advertisements' AND column_name='ad_copy')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='advertisements' AND column_name='copy') THEN
    ALTER TABLE public.advertisements RENAME COLUMN ad_copy TO copy;
  END IF;
END $$;

ALTER TABLE public.advertisements ALTER COLUMN duration_days DROP NOT NULL;

ALTER TABLE public.advertisements DROP CONSTRAINT IF EXISTS advertisements_status_check;
ALTER TABLE public.advertisements ADD CONSTRAINT advertisements_status_check
  CHECK (status = ANY (ARRAY['draft','pending','pending_payment','pending_review','active','expired','cancelled','rejected','quarantined','discarded']));

ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS package_days integer;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS package_price_pence integer;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS stripe_session_id text;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS final_reminder_sent_at timestamptz;

NOTIFY pgrst, 'reload schema';

COMMIT;
