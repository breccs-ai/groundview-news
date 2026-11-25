import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, ADMIN_MARKER_COOKIE } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The session cookie is httpOnly, so only the server can clear it.
export async function POST() {
  cookies().set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  cookies().set(ADMIN_MARKER_COOKIE, '', { path: '/', maxAge: 0 });
  return NextResponse.json({ success: true });
}
