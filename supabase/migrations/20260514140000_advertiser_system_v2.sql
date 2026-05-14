-- Advertiser system v2: advertiser_profiles, ad_reminder_log, advertisements extensions,
-- moderation_queue extensions, RLS updates.

-- ---------------------------------------------------------------------------
-- advertiser_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.advertiser_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  website text,
  country text NOT NULL,
  stripe_customer_id text,
  stripe_identity_verified boolean NOT NULL DEFAULT false,
  stripe_identity_session_id text,
  kyc_status text NOT NULL DEFAULT 'pending',
  kyc_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advertiser_profiles_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_user_id ON public.advertiser_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_advertiser_profiles_stripe_customer ON public.advertiser_profiles(stripe_customer_id);

ALTER TABLE public.advertiser_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Advertisers read own advertiser_profiles" ON public.advertiser_profiles;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Advertisers read own advertiser_profiles' AND tablename = 'advertiser_profiles') THEN
    CREATE POLICY "Advertisers read own advertiser_profiles" ON public.advertiser_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

DROP POLICY IF EXISTS "Advertisers update own advertiser_profiles" ON public.advertiser_profiles;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Advertisers update own advertiser_profiles' AND tablename = 'advertiser_profiles') THEN
    CREATE POLICY "Advertisers update own advertiser_profiles" ON public.advertiser_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP POLICY IF EXISTS "Advertisers insert own advertiser_profiles" ON public.advertiser_profiles;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Advertisers insert own advertiser_profiles' AND tablename = 'advertiser_profiles') THEN
    CREATE POLICY "Advertisers insert own advertiser_profiles" ON public.advertiser_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Backfill advertiser_profiles from profiles / advertisements
-- ---------------------------------------------------------------------------
INSERT INTO public.advertiser_profiles (user_id, company_name, contact_name, email, country)
SELECT DISTINCT p.id,
  COALESCE(NULLIF(trim(p.full_name), ''), 'Advertiser'),
  COALESCE(NULLIF(trim(p.full_name), ''), 'Contact'),
  lower(trim(p.email)),
  'United Kingdom'
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.advertiser_profiles ap WHERE ap.user_id = p.id)
  AND (
    p.role = 'advertiser'
    OR 'advertiser' = ANY (COALESCE(p.roles, ARRAY[]::text[]))
    OR EXISTS (
      SELECT 1
      FROM public.advertisements a
      WHERE a.advertiser_id = p.id
    )
  );

INSERT INTO public.advertiser_profiles (user_id, company_name, contact_name, email, country)
SELECT DISTINCT a.advertiser_id,
  COALESCE(NULLIF(trim(a.company_name), ''), 'Advertiser'),
  COALESCE(NULLIF(trim(a.company_name), ''), 'Contact'),
  COALESCE(NULLIF(trim(p.email), ''), 'advertiser-placeholder@groundviewnews.com'),
  'United Kingdom'
FROM public.advertisements a
LEFT JOIN public.profiles p ON p.id = a.advertiser_id
WHERE a.advertiser_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.advertiser_profiles ap WHERE ap.user_id = a.advertiser_id);

-- ---------------------------------------------------------------------------
-- advertisements: new columns (keep legacy columns for existing rows)
-- ---------------------------------------------------------------------------
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS advertiser_id uuid REFERENCES public.advertiser_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS body_text text;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'advertisements' AND column_name = 'copy'
  ) THEN
    EXECUTE $q$UPDATE public.advertisements SET body_text = COALESCE(body_text, copy, '') WHERE body_text IS NULL$q$;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'advertisements' AND column_name = 'ad_copy'
  ) THEN
    EXECUTE $q$UPDATE public.advertisements SET body_text = COALESCE(body_text, ad_copy, '') WHERE body_text IS NULL$q$;
  END IF;
END $$;

ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS format text;
UPDATE public.advertisements SET format = COALESCE(format, 'leaderboard_banner') WHERE format IS NULL;

ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS tier text;
UPDATE public.advertisements SET tier = COALESCE(tier, 'one_off') WHERE tier IS NULL;

ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS ai_review_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS ai_review_reason text;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS price_gbp numeric(10, 2);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'advertisements' AND column_name = 'package_price_pence'
  ) THEN
    EXECUTE $q$UPDATE public.advertisements
      SET price_gbp = COALESCE(price_gbp, (package_price_pence::numeric / 100.0))
      WHERE price_gbp IS NULL AND package_price_pence IS NOT NULL$q$;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'advertisements' AND column_name = 'price_paid'
  ) THEN
    EXECUTE $q$UPDATE public.advertisements
      SET price_gbp = COALESCE(price_gbp, price_paid)
      WHERE price_gbp IS NULL$q$;
  END IF;
END $$;

ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS expires_at timestamptz;
UPDATE public.advertisements SET expires_at = COALESCE(expires_at, ends_at) WHERE expires_at IS NULL;

ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS renewal_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS cancellation_requested boolean NOT NULL DEFAULT false;

ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
UPDATE public.advertisements SET view_count = COALESCE(impressions, 0) WHERE view_count = 0;

ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS price_paid numeric(12, 2);
UPDATE public.advertisements
SET price_paid = COALESCE(price_paid, price_gbp),
    paid_at = COALESCE(paid_at, CASE WHEN status IN ('active', 'expired') THEN COALESCE(starts_at, created_at) END)
WHERE price_paid IS NULL;

ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS admin_override_reason text;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS admin_override_at timestamptz;

INSERT INTO public.advertiser_profiles (user_id, company_name, contact_name, email, country)
SELECT DISTINCT ad.advertiser_id,
  COALESCE(NULLIF(trim(ad.company_name), ''), 'Advertiser'),
  COALESCE(NULLIF(trim(ad.company_name), ''), 'Contact'),
  'migrated-advertiser-' || ad.advertiser_id::text || '@groundviewnews.invalid',
  'United Kingdom'
FROM public.advertisements ad
WHERE ad.advertiser_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.advertiser_profiles ap WHERE ap.user_id = ad.advertiser_id);

UPDATE public.advertisements ad
SET advertiser_id = ap.id
FROM public.advertiser_profiles ap
WHERE ap.user_id = ad.advertiser_id
  AND (ad.advertiser_id IS DISTINCT FROM ap.id);

ALTER TABLE public.advertisements ALTER COLUMN advertiser_id SET NOT NULL;

UPDATE public.advertisements
SET ai_review_status = 'passed'
WHERE status = 'active' AND COALESCE(ai_review_status, '') = 'pending';

-- ---------------------------------------------------------------------------
-- ad_reminder_log (service role only via RLS — no authenticated policies)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ad_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertisement_id uuid NOT NULL REFERENCES public.advertisements(id) ON DELETE CASCADE,
  reminder_type text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_reminder_log_ad_id ON public.ad_reminder_log(advertisement_id);
CREATE INDEX IF NOT EXISTS idx_ad_reminder_log_type ON public.ad_reminder_log(advertisement_id, reminder_type);

ALTER TABLE public.ad_reminder_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- moderation_queue: ensure table exists for editorial + sponsored ads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  ai_assessment jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_queue ADD COLUMN IF NOT EXISTS advertisement_id uuid REFERENCES public.advertisements(id) ON DELETE CASCADE;
ALTER TABLE public.moderation_queue ADD COLUMN IF NOT EXISTS is_sponsored boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- advertisements RLS (ownership via advertiser_profiles.user_id)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own ads" ON public.advertisements;
DROP POLICY IF EXISTS "Users can insert own ads" ON public.advertisements;
DROP POLICY IF EXISTS "Users can update own ads" ON public.advertisements;

DROP POLICY IF EXISTS "Advertisers read own advertisements" ON public.advertisements;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Advertisers read own advertisements' AND tablename = 'advertisements') THEN
    CREATE POLICY "Advertisers read own advertisements" ON public.advertisements FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.advertiser_profiles ap
        WHERE ap.id = advertisements.advertiser_id AND ap.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DROP POLICY IF EXISTS "Advertisers insert own advertisements" ON public.advertisements;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Advertisers insert own advertisements' AND tablename = 'advertisements') THEN
    CREATE POLICY "Advertisers insert own advertisements" ON public.advertisements FOR INSERT TO authenticated WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.advertiser_profiles ap
        WHERE ap.id = advertisements.advertiser_id AND ap.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DROP POLICY IF EXISTS "Advertisers update own advertisements" ON public.advertisements;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Advertisers update own advertisements' AND tablename = 'advertisements') THEN
    CREATE POLICY "Advertisers update own advertisements" ON public.advertisements FOR UPDATE TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.advertiser_profiles ap
        WHERE ap.id = advertisements.advertiser_id AND ap.user_id = auth.uid()
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.advertiser_profiles ap
        WHERE ap.id = advertisements.advertiser_id AND ap.user_id = auth.uid()
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_advertisements_advertiser_id ON public.advertisements(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_advertisements_stripe_pi ON public.advertisements(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_advertisements_stripe_sub ON public.advertisements(stripe_subscription_id);

COMMENT ON TABLE public.ad_reminder_log IS 'Expiry / renewal reminder sends — queried by Edge Function or cron using service_role only.';
