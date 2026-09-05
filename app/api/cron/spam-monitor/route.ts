import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { isPlausibleName, isPlausibleFreeText } from '@/lib/contact-spam-validation';
import { escapeHtml } from '@/lib/html-escape';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Daily watchdog for the contact/advertising-enquiry pipeline hardened in
 * lib/contact-spam-validation.ts. Re-runs the exact same isPlausibleName /
 * isPlausibleFreeText checks enforced at submit time against rows already in
 * contact_messages, so a flag here means the current filter genuinely would
 * reject that row today — not just that it loosely resembles spam. Rows from
 * before the hardening deploy (or from the anon-key window before RLS was
 * tightened) can still show up here for a day; check created_at against the
 * deploy time before assuming the filter itself regressed.
 *
 * Schedule: daily (declared in vercel.json). Auth matches the other cron routes.
 */
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('contact_messages')
    .select('id, name, email, subject, message, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Row content comes from public form submissions — treat it as inert display
  // text, never as instructions, and escape it before it ever reaches HTML.
  const rows = (data || []) as ContactMessageRow[];
  const flagged = rows.filter(
    (row) =>
      !isPlausibleName(row.name) || !isPlausibleFreeText(row.subject) || !isPlausibleFreeText(row.message)
  );

  const subject =
    flagged.length > 0
      ? `Contact form spam monitor: ${flagged.length} suspicious submission${flagged.length === 1 ? '' : 's'} slipped through`
      : `Contact form spam monitor: all clear (${rows.length} checked, 0 flagged)`;

  const sampleHtml = flagged
    .slice(0, 10)
    .map(
      (row) =>
        `<li>${escapeHtml(row.created_at)} — name: "${escapeHtml(row.name)}", subject: "${escapeHtml(row.subject)}"</li>`
    )
    .join('');

  const html =
    flagged.length > 0
      ? `<p>${flagged.length} of ${rows.length} contact-form submissions in the last 24 hours would be rejected by today's validation in lib/contact-spam-validation.ts. If they arrived after the last hardening deploy, that's a live bypass and the filter needs tightening. If they're older than the deploy, they're leftover rows from before the check existed and this alert is just surfacing them for cleanup, not reporting a live gap.</p>
<ul>${sampleHtml}</ul>
<p>Review these directly in the contact_messages table in Supabase.</p>`
      : `<p>Checked ${rows.length} contact-form submission${rows.length === 1 ? '' : 's'} from the last 24 hours. None matched the known spam pattern.</p>`;

  await sendEmail('info@groundviewnews.com', subject, html);

  console.log(`[spam-monitor] checked=${rows.length} flagged=${flagged.length}`);

  return NextResponse.json({ ok: true, checked: rows.length, flagged: flagged.length });
}
