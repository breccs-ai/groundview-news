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

async function unsubscribe(id: string, token: string): Promise<NextResponse> {
  if (!verifyUnsubscribeToken(id, token)) {
    return htmlPage('This unsubscribe link is invalid or has expired. Please contact info@groundviewnews.com if you keep receiving emails you did not expect.');
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return htmlPage('Something went wrong on our end. Please try again shortly, or contact info@groundviewnews.com.');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ writer_reminder_opt_out: true })
    .eq('id', id);

  if (error) {
    return htmlPage('Something went wrong on our end. Please try again shortly, or contact info@groundviewnews.com.');
  }

  return htmlPage(
    "You have been unsubscribed from writer activity and earnings reminder emails. You will still receive essential account emails — application decisions, article approvals, and payment statements — since those aren't optional notifications."
  );
}

// Opened from the email footer. This only shows a confirmation page and never
// changes anything: mail security scanners routinely open every link in an
// email, and opting out on GET would silently unsubscribe writers who never
// asked. The button on this page POSTs back to this same URL.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || '';
  const token = req.nextUrl.searchParams.get('token') || '';
  if (!verifyUnsubscribeToken(id, token)) {
    return htmlPage('This unsubscribe link is invalid or has expired. Please contact info@groundviewnews.com if you keep receiving emails you did not expect.');
  }

  const action = `/api/journalists/unsubscribe-reminders?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
  return htmlPage(
    `Do you want to stop receiving writer activity and earnings reminder emails from Ground View News?
    <form method="post" action="${escapeHtml(action)}" style="margin-top:24px;">
      <button type="submit" style="background:#0f1f3d;color:#ffffff;border:0;padding:12px 24px;border-radius:4px;font-size:15px;font-family:Arial,Helvetica,sans-serif;font-weight:bold;cursor:pointer;">Confirm unsubscribe</button>
    </form>
    <p style="font-size:13px;color:#666;margin-top:20px;">If you opened this by mistake, you can simply close this page and nothing will change. You will still receive essential account emails either way.</p>`
  );
}

// Performs the unsubscribe. Called by the confirmation button above, and
// directly by mail clients using one-click unsubscribe (RFC 8058, triggered by
// the List-Unsubscribe-Post header), which POST without showing any page.
export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || '';
  const token = req.nextUrl.searchParams.get('token') || '';
  return unsubscribe(id, token);
}
