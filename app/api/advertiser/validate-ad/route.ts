import { NextRequest, NextResponse } from 'next/server';
import { runAdvertisementValidation } from '@/lib/advertiser/validate-ad-internal';

export const runtime = 'nodejs';

function authorize(req: NextRequest): boolean {
  const h = req.headers.get('authorization');
  const token = h?.startsWith('Bearer ') ? h.slice(7) : '';
  const secret = process.env.VALIDATE_AD_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  return token === secret;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const advertisementId =
    body && typeof body === 'object' && typeof (body as { advertisement_id?: string }).advertisement_id === 'string'
      ? (body as { advertisement_id: string }).advertisement_id.trim()
      : '';
  if (!advertisementId) {
    return NextResponse.json({ error: 'Missing advertisement_id' }, { status: 400 });
  }
  const result = await runAdvertisementValidation(advertisementId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
