-- Central suppression list for outbound marketing/cold-outreach email.
-- Nothing in this codebase previously suppressed a general marketing send:
-- subscribers.unsubscribed_at exists but no code path ever writes to it, and
-- the newsletter's own "unsubscribe" is a manual reply instruction. This table
-- is the one list every outbound send (list build AND per-batch send time)
-- must check before an email goes to a given address.

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  reason text NOT NULL DEFAULT 'unsubscribed'
    CHECK (reason IN ('unsubscribed', 'bounced', 'complained', 'manual')),
  source text,
  notes text,
  suppressed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness: the same address must not be suppressed twice
-- under different casing, and this index is also the lookup path a send job
-- uses to check an address before it fires.
CREATE UNIQUE INDEX IF NOT EXISTS email_suppressions_email_lower_idx
  ON public.email_suppressions (lower(email));

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: this list is only ever read or written by
-- server-side code using the service role, matching writer_payout_profiles.
COMMENT ON TABLE public.email_suppressions IS
  'Suppression list for outbound marketing/cold-outreach email. Checked at recipient-list build time and again at send time before every batch. Populated by unsubscribe clicks, bounce/complaint handling, and manual admin suppression. Service-role access only.';
