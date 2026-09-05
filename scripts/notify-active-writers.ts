/**
 * One-off announcement: reminds every approved, active journalist to log in
 * and publish, and outlines how reader engagement/sharing grows their
 * earnings. Not wired into any route — run manually, once.
 *
 * Dry run (default, sends nothing):
 *   npx tsx scripts/notify-active-writers.ts
 *
 * Actually send:
 *   npx tsx scripts/notify-active-writers.ts --send
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * RESEND_API_KEY in the environment (pull them from Vercel's project env,
 * or set them inline for this one command).
 */
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { WRITER_EMAIL_FROM, writerActivityReminderEmail } from '@/lib/writer-emails';

type Recipient = { id: string; email: string; full_name: string | null };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const send = process.argv.includes('--send');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  if (send && !process.env.RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY — required to actually send (omit --send for a dry run).');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('subscription_status', 'active')
    .or('role.eq.journalist,roles.cs.{journalist}');

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  const recipients = ((data || []) as Recipient[]).filter((r) => r.email);
  console.log(`Found ${recipients.length} active journalist(s).`);
  recipients.forEach((r) => console.log(`  - ${r.full_name || '(no name)'} <${r.email}>`));

  if (!send) {
    console.log('\nDry run only — nothing was sent. Re-run with --send to actually email these writers.');
    return;
  }

  let sent = 0;
  for (const r of recipients) {
    const tmpl = writerActivityReminderEmail({ fullName: r.full_name || '' });
    try {
      await sendEmail(r.email, tmpl.subject, tmpl.html, WRITER_EMAIL_FROM);
      sent += 1;
      console.log(`Sent to ${r.email}`);
    } catch (e) {
      console.error(`Failed to send to ${r.email}:`, e instanceof Error ? e.message : e);
    }
    await sleep(250);
  }
  console.log(`\nDone. Sent ${sent}/${recipients.length}.`);
}

main();
