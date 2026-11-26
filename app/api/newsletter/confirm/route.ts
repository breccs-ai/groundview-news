import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyNewsletterToken } from '@/lib/newsletter-tokens';
import { NEWSLETTER_BUTTON_STYLE, newsletterHtmlPage } from '@/lib/newsletter-pages';
import { escapeHtml } from '@/lib/email-branding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INVALID =
  'This confirmation link is invalid or has expired. You can subscribe again from groundviewnews.com, or contact info@groundviewnews.com for help.';
const FAILED = 'Something went wrong on our end. Please try again shortly, or contact info@groundviewnews.com.';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Opened from the confirmation email. This only shows a button and never confirms
// anyone: mail security scanners open every link in an email, and confirming on GET
// would subscribe addresses whose owners never saw the message.
export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  const token = req.nextUrl.searchParams.get('token') || '';
  if (!email || !verifyNewsletterToken('confirm', email, token)) return newsletterHtmlPage(INVALID);

  const action = `/api/newsletter/confirm?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  return newsletterHtmlPage(
    `Confirm that <strong>${escapeHtml(email)}</strong> should receive the Ground View News weekly newsletter.
    <form method="post" action="${escapeHtml(action)}" style="margin-top:24px;">
      <button type="submit" style="${NEWSLETTER_BUTTON_STYLE}">Confirm my subscription</button>
    </form>
    <p style="font-size:13px;color:#666;margin-top:20px;">If you did not sign up, close this page and nothing will change.</p>`
  );
}

export async function POST(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  const token = req.nextUrl.searchParams.get('token') || '';
  if (!email || !verifyNewsletterToken('confirm', email, token)) return newsletterHtmlPage(INVALID);

  const supabase = getServiceSupabase();
  if (!supabase) return newsletterHtmlPage(FAILED);

  const { data: row, error: findError } = await supabase
    .from('subscribers')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (findError) return newsletterHtmlPage(FAILED);
  if (!row) {
    return newsletterHtmlPage('We could not find this signup. Please subscribe again from groundviewnews.com.');
  }

  const { error } = await supabase
    .from('subscribers')
    .update({ confirmed: true, unsubscribed_at: null })
    .eq('id', row.id);
  if (error) return newsletterHtmlPage(FAILED);

  // Confirming again is a fresh, explicit opt-in, so it lifts an earlier newsletter
  // unsubscribe. It never touches bounce, complaint or manual suppressions, or an
  // unsubscribe from anything other than this newsletter.
  await supabase
    .from('email_suppressions')
    .delete()
    .eq('email', email)
    .eq('reason', 'unsubscribed')
    .eq('source', 'newsletter');

  return newsletterHtmlPage('Thank you. Your subscription is confirmed, and you will receive the Ground View News weekly newsletter.');
}
