import { NextResponse } from 'next/server';
import { isAdminServerSession } from '@/lib/admin-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lets the admin screens confirm the signed session is genuinely valid, since
// the browser can only see the non-secret marker cookie.
export async function GET() {
  return NextResponse.json({ authenticated: isAdminServerSession() });
}
