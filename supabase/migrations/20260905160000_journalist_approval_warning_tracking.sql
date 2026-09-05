-- Tracks whether the 12-hours-remaining warning has already been sent for a
-- journalist-application review assignment, so the hourly cron in
-- app/api/cron/journalist-approval-warnings/route.ts doesn't re-notify on
-- every run while an assignment sits in its second 12 hours.
ALTER TABLE IF EXISTS public.journalist_approval_assignments
  ADD COLUMN IF NOT EXISTS warning_sent_at timestamptz;
