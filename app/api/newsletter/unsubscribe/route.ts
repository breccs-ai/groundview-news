import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyNewsletterToken } from '@/lib/newsletter-tokens';
import { NEWSLETTER_BUTTON_STYLE, newsletterHtmlPage } from '@/lib/newsletter-pages';
import { escapeHtml } from '@/lib/email-branding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INVALID =
  'This unsubscribe link is invalid or has expired. Please contact info@groundviewnews.com if you keep receiving emails you did not expect.';
const FAILED = 'Something went wrong on our end. Please try again shortly, or contact info@groundviewnews.com.';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Opened from the newsletter footer. Shows a button only: mail security scanners
// open every link in an email, and unsubscribing on GET would silently remove
// readers who never asked to leave. The button POSTs back to this same URL.
export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  const token = req.nextUrl.searchParams.get('token') || '';
  if (!email || !verifyNewsletterToken('unsubscribe', email, token)) return newsletterHtmlPage(INVALID);

  const action = `/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  return newsletterHtmlPage(
    `Do you want to stop receiving the Ground View News newsletter at <strong>${escapeHtml(email)}</strong>?
    <form method="post" action="${escapeHtml(action)}" style="margin-top:24px;">
      <button type="submit" style="${NEWSLETTER_BUTTON_STYLE}">Confirm unsubscribe</button>
    </form>
    <p style="font-size:13px;color:#666;margin-top:20px;">If you opened this by mistake, close this page and nothing will change.</p>`
  );
}

// Called by the confirmation button, and directly by mail clients using one-click
// unsubscribe (RFC 8058, triggered by the List-Unsubscribe-Post header).
export async function POST(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  const token = req.nextUrl.searchParams.get('token') || '';
  if (!email || !verifyNewsletterToken('unsubscribe', email, token)) return newsletterHtmlPage(INVALID);

  const supabase = getServiceSupabase();
  if (!supabase) return newsletterHtmlPage(FAILED);

  // The suppression row is what stops every send, including to paid members who have
  // no row in `subscribers`. An address that is already suppressed is left as it is.
  const { data: existing, error: findError } = await supabase
    .from('email_suppressions')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (findError) return newsletterHtmlPage(FAILED);

  if (!existing) {
    const { error } = await supabase.from('email_suppressions').insert({
      email,
      reason: 'unsubscribed',
      source: 'newsletter',
      suppressed_at: new Date().toISOString(),
    });
    if (error) return newsletterHtmlPage(FAILED);
  }

  // The privacy policy promises the address is removed from the subscriber list.
  const { error: deleteError } = await supabase.from('subscribers').delete().eq('email', email);
  if (deleteError) return newsletterHtmlPage(FAILED);

  return newsletterHtmlPage('You have been unsubscribed and will not receive the Ground View News newsletter again.');
}
