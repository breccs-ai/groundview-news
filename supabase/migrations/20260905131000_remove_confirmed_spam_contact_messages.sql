-- Permanently remove the two contact_messages rows confirmed as pre-hardening
-- spam (bot-generated name/subject pairs matching the pattern lib/contact-
-- spam-validation.ts now rejects at submit time). Matched on email+subject+name
-- rather than id or created_at, since those are the values that were verified
-- by hand and are stable across the sources they were reviewed in.
--
-- This is a one-time, targeted cleanup of two specific rows — not a general
-- sweep. See the accompanying message for a read-only query to review the rest
-- of the table for anything else that looks similar before deleting further;
-- that step needs a human look, not an automated rule, since it operates on
-- rows this migration's author never saw in full.
DELETE FROM public.contact_messages
WHERE (email = 'norrisa@wcschools.com' AND subject = 'OngleLtjmOXYNQuK' AND name = 'Atayci Svslomzc')
   OR (email = 'patrick3171971@outlook.com' AND subject = 'OahzVkPbMjzZfCSfrorAXC' AND name = 'Jpixuxec Fcacj');
