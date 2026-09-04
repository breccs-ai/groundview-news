import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { looksLikeRandomToken } from '@/lib/contact-spam-validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Daily watchdog for the contact/advertising-enquiry pipeline hardened in
 * lib/contact-spam-validation.ts. Server-side validation should already reject
 * the known spam pattern before it reaches contact_messages, so any row here
 * that still matches it means the filter needs tightening — this alerts on
 * that, and reports "0 flagged" on healthy days so silence never gets read as
 * "nobody's watching".
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

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
      looksLikeRandomToken(row.name) ||
      looksLikeRandomToken(row.subject) ||
      looksLikeRandomToken(row.message)
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
      ? `<p>${flagged.length} of ${rows.length} contact-form submissions in the last 24 hours matched the known spam pattern despite server-side validation rejecting it at submit time. That means the filter in lib/contact-spam-validation.ts may need tightening.</p>
<ul>${sampleHtml}</ul>
<p>Review these directly in the contact_messages table in Supabase.</p>`
      : `<p>Checked ${rows.length} contact-form submission${rows.length === 1 ? '' : 's'} from the last 24 hours. None matched the known spam pattern.</p>`;

  await sendEmail('info@groundviewnews.com', subject, html);

  return NextResponse.json({ ok: true, checked: rows.length, flagged: flagged.length });
}
