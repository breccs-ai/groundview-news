import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, ADMIN_MARKER_COOKIE } from '@/lib/admin-auth';
import { ADMIN_SESSION_SECONDS, adminPasswordMatches, createAdminSessionToken } from '@/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Best-effort brute-force slowdown: this is per server instance, so it blunts
// guessing but is not a hard global limit.
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: NextRequest): string {
  return (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!process.env.ADMIN_PASSWORD) {
    console.error('[admin-auth] ADMIN_PASSWORD env var is not set');
    return NextResponse.json(
      { error: 'Server misconfigured: ADMIN_PASSWORD is not set. Add it to your Vercel environment variables.' },
      { status: 500 }
    );
  }

  const key = clientKey(req);
  const now = Date.now();
  const entry = failures.get(key);
  if (entry && entry.resetAt > now && entry.count >= MAX_FAILURES) {
    return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  }

  if (!adminPasswordMatches(password)) {
    const current = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + WINDOW_MS };
    current.count += 1;
    failures.set(key, current);
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const token = createAdminSessionToken();
  if (!token) {
    return NextResponse.json({ error: 'Server misconfigured: cannot create a session.' }, { status: 500 });
  }
  failures.delete(key);

  const secure = process.env.NODE_ENV === 'production';
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: ADMIN_SESSION_SECONDS,
    path: '/',
  });
  // Non-secret flag so the browser can show admin buttons; never trusted by the server.
  cookies().set(ADMIN_MARKER_COOKIE, '1', {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    maxAge: ADMIN_SESSION_SECONDS,
    path: '/',
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const configured = !!process.env.ADMIN_PASSWORD;
  return NextResponse.json({ configured });
}
