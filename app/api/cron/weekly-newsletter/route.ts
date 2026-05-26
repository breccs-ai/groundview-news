import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Vercel cron entry: triggers the Supabase Edge Function `weekly-newsletter`.
 *
 * Schedule: Monday 08:00 UTC (declared in vercel.json).
 * Auth    : Bearer CRON_SECRET, matching the pattern used by other cron
 *           routes in this codebase (expire-ads, ad-reminders, calculate-revenue).
 *
 * The edge function itself also requires `x-cron-secret` matching CRON_SECRET,
 * so the secret is checked twice — once at the Vercel boundary, once at the
 * Supabase Edge boundary — preventing unauthenticated invocation of either.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cronSecret = process.env.CRON_SECRET || '';
  if (!projectUrl) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const base = projectUrl.replace(/\/$/, '');
  const fnUrl = `${base}/functions/v1/weekly-newsletter`;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
        // Supabase edge functions require an Authorization header from the
        // Supabase gateway side; use the service role key for that hop.
        ...(serviceKey ? { Authorization: `Bearer ${serviceKey}` } : {}),
      },
    });
    const body = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: 'Edge function failed', status: res.status, body }, { status: 502 });
    }
    return new NextResponse(body, {
      status: 200,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (e) {
    console.error('[cron/weekly-newsletter]', e);
    return NextResponse.json({ error: 'Invocation failed' }, { status: 500 });
  }
}
