import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { coldOutreachIntroEmail, OUTREACH_EMAIL_FROM } from '@/lib/cold-outreach-emails';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Recipient = {
  id: string;
  email: string;
  organisation: string | null;
};

/**
 * Daily cold-outreach batch sender (declared in vercel.json, weekdays only).
 * Asks "what's pending and due today or earlier?" against outreach_recipients
 * on every run — no session-bound state. Re-checks email_suppressions here,
 * at send time, since someone can unsubscribe between when a recipient was
 * queued and when their scheduled day arrives.
 *
 * Pass ?dry_run=true to simulate a run with zero writes and zero sends —
 * used to verify suppression handling, targeting, and content before the
 * first real batch goes out.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get('dry_run') === 'true';
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const today = new Date().toISOString().slice(0, 10);

  const { data: due, error: dueErr } = await supabase
    .from('outreach_recipients')
    .select('id, email, organisation')
    .eq('status', 'pending')
    .lte('scheduled_date', today);

  if (dueErr) return NextResponse.json({ error: dueErr.message }, { status: 400 });

  const recipients = (due || []) as Recipient[];
  if (recipients.length === 0) {
    console.log(`[cold-outreach-send] dry_run=${dryRun} due=0`);
    return NextResponse.json({ ok: true, dry_run: dryRun, due: 0, sent: 0, suppressed: 0, failed: 0 });
  }

  // Re-check suppression at send time, not just at list-build time.
  const { data: suppressedRows, error: suppErr } = await supabase
    .from('email_suppressions')
    .select('email')
    .in(
      'email',
      recipients.map((r) => r.email.toLowerCase())
    );
  if (suppErr) return NextResponse.json({ error: suppErr.message }, { status: 400 });
  const suppressedSet = new Set((suppressedRows || []).map((r) => String(r.email).toLowerCase()));

  let sent = 0;
  let suppressed = 0;
  let failed = 0;
  const sample: Array<{ email: string; outcome: string }> = [];

  for (const recipient of recipients) {
    const email = recipient.email.toLowerCase();

    if (suppressedSet.has(email)) {
      suppressed += 1;
      if (sample.length < 10) sample.push({ email, outcome: 'suppressed' });
      if (!dryRun) {
        await supabase
          .from('outreach_recipients')
          .update({ status: 'suppressed', updated_at: new Date().toISOString() })
          .eq('id', recipient.id);
      }
      continue;
    }

    if (dryRun) {
      sent += 1;
      if (sample.length < 10) sample.push({ email, outcome: 'would_send' });
      continue;
    }

    const { subject, html, headers } = coldOutreachIntroEmail({
      organisationName: recipient.organisation || '',
      email,
    });
    const ok = await sendEmail(email, subject, html, OUTREACH_EMAIL_FROM, headers);

    if (ok) {
      sent += 1;
      await supabase
        .from('outreach_recipients')
        .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', recipient.id);
    } else {
      failed += 1;
      await supabase
        .from('outreach_recipients')
        .update({ status: 'failed', error: 'sendEmail returned false', updated_at: new Date().toISOString() })
        .eq('id', recipient.id);
    }
  }

  console.log(
    `[cold-outreach-send] dry_run=${dryRun} due=${recipients.length} sent=${sent} suppressed=${suppressed} failed=${failed}`
  );

  return NextResponse.json({
    ok: true,
    dry_run: dryRun,
    due: recipients.length,
    ...(dryRun
      ? { would_send: sent, would_suppress: suppressed }
      : { sent, suppressed, failed }),
    sample,
  });
}
