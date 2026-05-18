-- Advertising pricing tiers: placement tier, billing cycle, annual discount, expiry_date

ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS billing_cycle text;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS annual_discount_applied boolean NOT NULL DEFAULT false;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS expiry_date date;

-- Backfill billing_cycle from legacy tier values (one_off / monthly / annual)
UPDATE public.advertisements
SET billing_cycle = tier
WHERE billing_cycle IS NULL
  AND tier IN ('one_off', 'monthly', 'annual');

-- Map legacy format + billing to placement tiers (basic / standard / premium)
UPDATE public.advertisements
SET tier = CASE
  WHEN format = 'leaderboard_banner' THEN 'premium'
  WHEN format = 'sponsored_article' THEN 'standard'
  ELSE 'basic'
END
WHERE tier IN ('one_off', 'monthly', 'annual');

-- Sync expiry_date from expires_at
UPDATE public.advertisements
SET expiry_date = (expires_at AT TIME ZONE 'UTC')::date
WHERE expiry_date IS NULL
  AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_advertisements_status_expiry
  ON public.advertisements (status, expiry_date)
  WHERE status = 'active';

COMMENT ON COLUMN public.advertisements.tier IS 'Placement tier: basic | standard | premium (legacy rows migrated from format)';
COMMENT ON COLUMN public.advertisements.billing_cycle IS 'Billing: monthly | annual | one_off (legacy)';
COMMENT ON COLUMN public.advertisements.annual_discount_applied IS 'True when annual upfront pricing included the standard annual discount';
COMMENT ON COLUMN public.advertisements.expiry_date IS 'Calendar expiry (UTC); kept in sync with expires_at';
