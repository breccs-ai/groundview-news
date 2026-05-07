import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ADMIN_COOKIE = 'gvn_admin_session';
const ADMIN_COOKIE_VALUE = 'authenticated';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('[admin-auth] ADMIN_PASSWORD env var is not set');
    return NextResponse.json(
      { error: 'Server misconfigured: ADMIN_PASSWORD is not set. Add it to your Vercel environment variables.' },
      { status: 500 }
    );
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  cookies().set(ADMIN_COOKIE, ADMIN_COOKIE_VALUE, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24,
    path: '/',
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const configured = !!process.env.ADMIN_PASSWORD;
  return NextResponse.json({ configured });
}
