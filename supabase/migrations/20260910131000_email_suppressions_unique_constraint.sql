-- supabase-js .upsert(..., { onConflict: 'email' }) needs a real constraint on
-- the literal `email` column to target — the existing unique index on
-- lower(email) isn't addressable that way. Every write path (unsubscribe
-- endpoint, send job) already normalizes to lowercase before storing, so a
-- plain unique constraint on email is safe and doesn't conflict with the
-- case-insensitive index already in place.
ALTER TABLE public.email_suppressions
  ADD CONSTRAINT email_suppressions_email_key UNIQUE (email);

-- Same reasoning for the recipient queue: the seed load needs an idempotent
-- upsert-by-email so re-running it never double-queues a recipient.
ALTER TABLE public.outreach_recipients
  ADD CONSTRAINT outreach_recipients_email_key UNIQUE (email);
