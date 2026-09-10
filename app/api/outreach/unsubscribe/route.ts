import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token';

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

// Clicked directly from the email footer.
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email') || '';
  const token = req.nextUrl.searchParams.get('token') || '';
  return unsubscribe(email, token);
}

// One-click unsubscribe (RFC 8058): mail clients that see the
// List-Unsubscribe-Post header call this directly, with no page shown to the
// user, so it must succeed without requiring the GET confirmation page.
export async function POST(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email') || '';
  const token = req.nextUrl.searchParams.get('token') || '';
  return unsubscribe(email, token);
}
