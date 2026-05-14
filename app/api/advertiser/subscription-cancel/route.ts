import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServiceSupabase } from '@/lib/supabase-service';

export const runtime = 'nodejs';

function getStripe(): Stripe | null {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) return null;
  return new Stripe(k);
}

function bearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization');
  if (!h?.toLowerCase().startsWith('bearer ')) return null;
  return h.slice(7).trim() || null;
}

export async function POST(req: NextRequest) {
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = getServiceSupabase();
  const stripe = getStripe();
  if (!service || !stripe) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const {
    data: { user },
    error: authErr,
  } = await service.auth.getUser(token);
  if (authErr || !user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const adId = body && typeof body === 'object' && typeof (body as { advertisement_id?: string }).advertisement_id === 'string'
    ? (body as { advertisement_id: string }).advertisement_id.trim()
    : '';

  if (!adId) return NextResponse.json({ error: 'Missing advertisement_id' }, { status: 400 });

  const { data: ad } = await service
    .from('advertisements')
    .select('id, advertiser_id, stripe_subscription_id')
    .eq('id', adId)
    .maybeSingle();

  const row = ad as { advertiser_id: string; stripe_subscription_id: string | null } | null;
  if (!row?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No active subscription for this ad' }, { status: 400 });
  }

  const { data: prof } = await service
    .from('advertiser_profiles')
    .select('user_id')
    .eq('id', row.advertiser_id)
    .maybeSingle();

  const p = prof as { user_id?: string } | null;
  if (!p || p.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await stripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: true });

  await service
    .from('advertisements')
    .update({ cancellation_requested: true, updated_at: new Date().toISOString() })
    .eq('id', adId);

  return NextResponse.json({ ok: true });
}
