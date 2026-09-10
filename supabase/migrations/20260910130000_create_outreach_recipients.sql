-- Durable, queryable batch table for the first-touch cold-outreach campaign.
-- A scheduled job (app/api/cron/cold-outreach-send) asks "what's due today?"
-- against this table on every run — no local file, no session-bound state.

CREATE TABLE IF NOT EXISTS public.outreach_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  organisation text,
  source text,
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed')),
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per address: the list was already de-duplicated before load, and
-- this guarantees the send job can never double-queue the same recipient.
CREATE UNIQUE INDEX IF NOT EXISTS outreach_recipients_email_lower_idx
  ON public.outreach_recipients (lower(email));

-- The send job's core query: "what's pending and due today?"
CREATE INDEX IF NOT EXISTS outreach_recipients_due_idx
  ON public.outreach_recipients (status, scheduled_date);

ALTER TABLE public.outreach_recipients ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: service-role access only, same as
-- writer_payout_profiles and email_suppressions.
COMMENT ON TABLE public.outreach_recipients IS
  'Batch queue for the cold-outreach campaign. status moves pending -> sent|suppressed|failed. Re-checked against email_suppressions at send time, not just at load time.';
