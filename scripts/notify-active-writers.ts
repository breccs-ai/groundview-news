/**
 * One-off announcement: reminds every approved, active journalist (who
 * hasn't opted out via the email's unsubscribe link) to log in and publish,
 * and outlines how reader engagement/sharing grows their earnings. Not wired
 * into any route — run manually, once.
 *
 * Dry run (default, sends nothing):
 *   npx tsx scripts/notify-active-writers.ts
 *
 * Actually send:
 *   npx tsx scripts/notify-active-writers.ts --send
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * RESEND_API_KEY. Loads .env.local the same way `next dev` does (plain
 * `tsx` does not do this on its own), so anything already in .env.local
 * (e.g. RESEND_API_KEY) is picked up without re-entering it. Vars not in
 * .env.local — typically the Supabase ones, which usually only live in
 * Vercel's dashboard — still need to be pulled in, e.g. via
 * `vercel env pull .env.local`, or set inline for this one command.
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { WRITER_EMAIL_FROM, writerActivityReminderEmail } from '@/lib/writer-emails';
import { fetchActiveWriters } from '@/lib/active-writers';

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
  let recipients;
  try {
    recipients = await fetchActiveWriters(supabase);
  } catch (e) {
    console.error('Query failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  console.log(`Found ${recipients.length} active journalist(s).`);
  recipients.forEach((r) => console.log(`  - ${r.full_name || '(no name)'} <${r.email}>`));

  if (!send) {
    console.log('\nDry run only — nothing was sent. Re-run with --send to actually email these writers.');
    return;
  }

  let sent = 0;
  const failed: string[] = [];
  for (const r of recipients) {
    const tmpl = writerActivityReminderEmail({ id: r.id, fullName: r.full_name || '' });
    const ok = await sendEmail(r.email, tmpl.subject, tmpl.html, WRITER_EMAIL_FROM, tmpl.headers);
    if (ok) {
      sent += 1;
      console.log(`Sent to ${r.email}`);
    } else {
      failed.push(r.email);
      console.error(`FAILED to send to ${r.email} (see [email] Resend error above)`);
    }
    await sleep(250);
  }
  console.log(`\nDone. Sent ${sent}/${recipients.length}.`);
  if (failed.length) {
    console.error(`${failed.length} failed: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main();
