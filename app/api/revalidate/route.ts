import { NextRequest, NextResponse } from 'next/server';
import { isAdminServerSession } from '@/lib/admin-server';
import { revalidateSite } from '@/lib/revalidate-site';

export const runtime = 'nodejs';

// Called by the admin screens after they edit, publish or reject an article. It
// used to be open to anyone, which let any visitor purge the site's page cache on
// demand. Server-side code that changes content calls revalidateSite() directly.
export async function POST(req: NextRequest) {
  if (!(await isAdminServerSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { slug } = await req.json().catch(() => ({}));
  revalidateSite(typeof slug === 'string' ? slug : undefined);
  return NextResponse.json({ revalidated: true });
}
