-- Lets a writer opt out of activity/earnings reminder emails specifically
-- (e.g. writerActivityReminderEmail in lib/writer-emails.ts) without affecting
-- essential account emails they still need (application decisions, article
-- approvals, payment statements), which are not covered by this flag.
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS writer_reminder_opt_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.writer_reminder_opt_out IS
  'Set via the one-click unsubscribe link in writer activity/earnings reminder emails. Scoped to that email category only — essential account emails are unaffected.';
