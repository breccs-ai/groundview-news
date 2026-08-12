-- Writer remuneration: payout preferences, earnings ledger support, and manual payment requests.

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.journalist_revenue_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journalist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month_start timestamptz,
  month_end timestamptz,
  total_ad_revenue numeric(12,2) NOT NULL DEFAULT 0,
  platform_costs numeric(12,2) NOT NULL DEFAULT 0,
  net_revenue numeric(12,2) NOT NULL DEFAULT 0,
  journalist_pool numeric(12,2) NOT NULL DEFAULT 0,
  weighted_views numeric(14,4) NOT NULL DEFAULT 0,
  total_weighted_views numeric(14,4) NOT NULL DEFAULT 0,
  view_share numeric(12,6) NOT NULL DEFAULT 0,
  amount_earned numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journalist_revenue_shares ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_journalist_revenue_shares_writer_month
  ON public.journalist_revenue_shares (journalist_id, month_start DESC);

CREATE TABLE IF NOT EXISTS public.writer_payout_profiles (
  journalist_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_method text NOT NULL CHECK (payment_method IN ('bank_transfer', 'wise', 'paypal', 'mobile_money', 'remittance_service', 'other')),
  recipient_name text NOT NULL,
  country text NOT NULL,
  currency text NOT NULL,
  service_name text,
  payment_details text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.writer_payout_profiles ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.writer_payout_profiles IS
  'Sensitive writer remittance preferences. Access is server-side only through authenticated APIs.';

CREATE TABLE IF NOT EXISTS public.writer_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journalist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'processing', 'paid', 'rejected', 'failed', 'cancelled')),
  writer_note text,
  payout_snapshot jsonb,
  admin_note text,
  transaction_reference text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processing_at timestamptz,
  paid_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.writer_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_writer_payment_requests_writer_created
  ON public.writer_payment_requests (journalist_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_writer_payment_requests_status
  ON public.writer_payment_requests (status, requested_at ASC);

CREATE OR REPLACE FUNCTION public.create_writer_payment_request(
  p_journalist_id uuid,
  p_amount numeric,
  p_minimum numeric DEFAULT 25,
  p_writer_note text DEFAULT NULL
)
RETURNS public.writer_payment_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earned numeric;
  v_committed numeric;
  v_available numeric;
  v_request public.writer_payment_requests;
  v_payout public.writer_payout_profiles;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_journalist_id::text, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_journalist_id
      AND subscription_status = 'active'
      AND (role = 'journalist' OR 'journalist' = ANY(COALESCE(roles, '{}')))
  ) THEN
    RAISE EXCEPTION 'Writer is not approved';
  END IF;

  SELECT * INTO v_payout
  FROM public.writer_payout_profiles
  WHERE journalist_id = p_journalist_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout profile is required';
  END IF;

  SELECT COALESCE(sum(amount_earned), 0)
  INTO v_earned
  FROM public.journalist_revenue_shares
  WHERE journalist_id = p_journalist_id;

  SELECT COALESCE(sum(amount), 0)
  INTO v_committed
  FROM public.writer_payment_requests
  WHERE journalist_id = p_journalist_id
    AND status IN ('requested', 'processing', 'paid');

  v_available := greatest(0, v_earned - v_committed);

  IF p_amount < p_minimum THEN
    RAISE EXCEPTION 'Payment request is below the minimum';
  END IF;
  IF p_amount > v_available THEN
    RAISE EXCEPTION 'Payment request exceeds available earnings';
  END IF;

  INSERT INTO public.writer_payment_requests (journalist_id, amount, writer_note, payout_snapshot)
  VALUES (p_journalist_id, round(p_amount, 2), nullif(trim(p_writer_note), ''), to_jsonb(v_payout))
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.create_writer_payment_request(uuid, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_writer_payment_request(uuid, numeric, numeric, text) TO service_role;

INSERT INTO public.site_settings (key, value)
VALUES ('writer_payment_minimum_gbp', '25')
ON CONFLICT (key) DO NOTHING;
