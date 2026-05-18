import { NextRequest, NextResponse } from 'next/server';

/**
 * Delegates ad expiry and reminder emails to the Supabase Edge Function
 * `ad-expiry-reminders` to avoid duplicating expiry logic in Vercel cron.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const fnUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/ad-expiry-reminders`;

  try {
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Edge function failed', status: res.status, body },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, delegated: true, result: body });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
