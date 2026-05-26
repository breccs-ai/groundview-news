-- Restore the columns the admin Revenue Shares page and the revenue cron
-- expect on public.journalist_revenue_shares. The admin UI was throwing
--   "column journalist_revenue_shares.view_share does not exist"
-- because view_share had not yet been added on this environment.
--
-- Every ADD COLUMN is wrapped in IF NOT EXISTS, and the ALTER TABLE uses
-- IF EXISTS, so this migration is fully idempotent and a safe no-op when
-- re-run.

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS view_share numeric(10,4) DEFAULT 0;

-- Related columns that the admin UI / cron job may rely on. Added defensively
-- in the same migration so the table schema is internally consistent.
ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS amount numeric(10,2) DEFAULT 0;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS period_start date;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS period_end date;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
