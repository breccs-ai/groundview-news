import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token';
import { escapeHtml } from '@/lib/email-branding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function htmlPage(message: string): NextResponse {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Ground View News</title></head>
<body style="margin:0;padding:60px 24px;background:#f6f6f4;font-family:Georgia,'Playfair Display',serif;color:#1a1a1a;text-align:center;">
  <div style="max-width:480px;margin:0 auto;">
    <h2 style="margin:0 0 16px;">Ground View <span style="color:#d4a017;">News</span></h2>
    <p style="font-size:15px;line-height:1.6;">${message}</p>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// The single suppression check every outbound send (list build AND send-time
// re-check) relies on — this is the only thing that ever writes to it via an
// unauthenticated request, and it's gated by the signed token below.
async function unsubscribe(email: string, token: string): Promise<NextResponse> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !verifyUnsubscribeToken(normalized, token)) {
    return htmlPage('This unsubscribe link is invalid or has expired. Please contact info@groundviewnews.com if you keep receiving emails you did not expect.');
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return htmlPage('Something went wrong on our end. Please try again shortly, or contact info@groundviewnews.com.');
  }

  const { error } = await supabase.from('email_suppressions').upsert(
    {
      email: normalized,
      reason: 'unsubscribed',
      source: 'cold_outreach',
      suppressed_at: new Date().toISOString(),
    },
    { onConflict: 'email' }
  );

  if (error) {
    return htmlPage('Something went wrong on our end. Please try again shortly, or contact info@groundviewnews.com.');
  }

  await supabase
    .from('outreach_recipients')
    .update({ status: 'suppressed', updated_at: new Date().toISOString() })
    .eq('email', normalized)
    .eq('status', 'pending');

  return htmlPage('You have been unsubscribed and will not receive further emails from Ground View News.');
}

// Opened from the email footer. This only shows a confirmation page and never
// unsubscribes anyone: mail security scanners routinely open every link in an
// email, and an unsubscribe on GET would silently opt out people who never
// asked to be removed. The button on this page POSTs back to this same URL.
export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  const token = req.nextUrl.searchParams.get('token') || '';
  if (!email || !verifyUnsubscribeToken(email, token)) {
    return htmlPage('This unsubscribe link is invalid or has expired. Please contact info@groundviewnews.com if you keep receiving emails you did not expect.');
  }

  const action = `/api/outreach/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  return htmlPage(
    `Do you want to stop receiving emails from Ground View News at <strong>${escapeHtml(email)}</strong>?
    <form method="post" action="${escapeHtml(action)}" style="margin-top:24px;">
      <button type="submit" style="background:#0f1f3d;color:#ffffff;border:0;padding:12px 24px;border-radius:4px;font-size:15px;font-family:Arial,Helvetica,sans-serif;font-weight:bold;cursor:pointer;">Confirm unsubscribe</button>
    </form>
    <p style="font-size:13px;color:#666;margin-top:20px;">If you opened this by mistake, you can simply close this page and nothing will change.</p>`
  );
}

// Performs the unsubscribe. Called by the confirmation button above, and
// directly by mail clients using one-click unsubscribe (RFC 8058, triggered by
// the List-Unsubscribe-Post header), which POST without showing any page.
export async function POST(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email') || '';
  const token = req.nextUrl.searchParams.get('token') || '';
  return unsubscribe(email, token);
}
