-- Add every journalist_revenue_shares column currently referenced by the
-- admin Revenue page and the revenue calculation route.
--
-- The immediate production error is:
--   column journalist_revenue_shares.weighted_views does not exist
--
-- This migration also adds the surrounding columns used by:
--   * app/admin/revenue/page.tsx
--   * app/api/cron/calculate-revenue/route.ts
--   * app/dashboard/page.tsx
--
-- Every statement is idempotent so this can safely run after earlier partial
-- migrations that already added view_share, amount, period fields, paid_at, or
-- status.

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS journalist_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS month_start timestamptz;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS month_end timestamptz;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS total_ad_revenue numeric(10,2) DEFAULT 0;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS platform_costs numeric(10,2) DEFAULT 0;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS net_revenue numeric(10,2) DEFAULT 0;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS journalist_pool numeric(10,2) DEFAULT 0;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS weighted_views numeric(10,4) DEFAULT 0;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS total_weighted_views numeric(10,4) DEFAULT 0;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS view_share numeric(10,4) DEFAULT 0;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS amount_earned numeric(10,2) DEFAULT 0;

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

ALTER TABLE IF EXISTS public.journalist_revenue_shares
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_journalist_revenue_shares_journalist_id
  ON public.journalist_revenue_shares (journalist_id);

CREATE INDEX IF NOT EXISTS idx_journalist_revenue_shares_month_start
  ON public.journalist_revenue_shares (month_start);
