import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import {
  getCheckoutPriceGbp,
  isBillingCycle,
  isPlacementTier,
  type BillingCycle,
  type PlacementTier,
} from '@/lib/advertiser/pricing';
import { formatForPlacementTier } from '@/lib/advertiser/placements';
import { isProhibitedDestinationUrl } from '@/lib/advertiser/url-blocklist';

export const runtime = 'nodejs';

function bearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization');
  if (!h?.toLowerCase().startsWith('bearer ')) return null;
  return h.slice(7).trim() || null;
}

export async function POST(req: NextRequest) {
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = getServiceSupabase();
  if (!service) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const {
    data: { user },
    error: authErr,
  } = await service.auth.getUser(token);
  if (authErr || !user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const body_text = typeof body.body_text === 'string' ? body.body_text.trim() : '';
  const destination_url = typeof body.destination_url === 'string' ? body.destination_url.trim() : '';
  const image_url = typeof body.image_url === 'string' ? body.image_url.trim() : '';
  const tier = body.tier as PlacementTier;
  const billing_cycle = body.billing_cycle as BillingCycle;

  if (!title || title.length > 80) {
    return NextResponse.json({ error: 'Title required, max 80 characters' }, { status: 400 });
  }
  if (body_text.length > 300) {
    return NextResponse.json({ error: 'Body text max 300 characters' }, { status: 400 });
  }
  if (!destination_url) {
    return NextResponse.json({ error: 'Destination URL required' }, { status: 400 });
  }
  try {
    // eslint-disable-next-line no-new
    new URL(destination_url);
  } catch {
    return NextResponse.json({ error: 'Invalid destination URL' }, { status: 400 });
  }
  if (isProhibitedDestinationUrl(destination_url)) {
    return NextResponse.json({ error: 'Destination URL is not allowed' }, { status: 400 });
  }
  if (!isPlacementTier(tier) || !isBillingCycle(billing_cycle)) {
    return NextResponse.json({ error: 'Invalid placement tier or billing cycle' }, { status: 400 });
  }

  const { data: prof, error: pErr } = await service
    .from('advertiser_profiles')
    .select('id, company_name, kyc_status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (pErr || !prof) {
    return NextResponse.json({ error: 'Advertiser profile not found' }, { status: 400 });
  }

  const pr = prof as { id: string; company_name: string; kyc_status: string };
  if (pr.kyc_status !== 'verified') {
    return NextResponse.json({ error: 'Complete identity verification before creating ads' }, { status: 403 });
  }

  const priceGbp = getCheckoutPriceGbp(tier, billing_cycle);
  const format = formatForPlacementTier(tier);
  const package_price_pence = Math.round(priceGbp * 100);
  const package_days = billing_cycle === 'annual' ? 365 : 30;

  const { data: inserted, error: insErr } = await service
    .from('advertisements')
    .insert({
      advertiser_id: pr.id,
      company_name: pr.company_name,
      title,
      copy: body_text,
      body_text,
      destination_url,
      image_url: image_url || null,
      format,
      tier,
      billing_cycle,
      annual_discount_applied: billing_cycle === 'annual',
      price_gbp: priceGbp,
      package_days,
      package_price_pence,
      status: 'pending_payment',
      ai_review_status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insErr || !inserted) {
    return NextResponse.json({ error: insErr?.message || 'Could not create ad' }, { status: 400 });
  }

  return NextResponse.json({ ad_id: (inserted as { id: string }).id });
}

export async function PATCH(req: NextRequest) {
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = getServiceSupabase();
  if (!service) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const {
    data: { user },
    error: authErr,
  } = await service.auth.getUser(token);
  if (authErr || !user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const ad_id = typeof body.ad_id === 'string' ? body.ad_id.trim() : '';
  if (!ad_id) return NextResponse.json({ error: 'Missing ad_id' }, { status: 400 });

  const { data: existing } = await service
    .from('advertisements')
    .select('id, advertiser_id, status, tier, billing_cycle')
    .eq('id', ad_id)
    .maybeSingle();

  const ex = existing as { advertiser_id: string; status: string; tier?: string; billing_cycle?: string } | null;
  if (!ex) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { data: ap } = await service.from('advertiser_profiles').select('user_id').eq('id', ex.advertiser_id).maybeSingle();
  const owner = ap as { user_id: string } | null;
  if (!owner || owner.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!['pending_payment', 'pending_review'].includes(ex.status)) {
    return NextResponse.json({ error: 'Ad cannot be edited in current status' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === 'string') {
    updates.title = body.title.trim().slice(0, 80);
    updates.copy = updates.title;
  }
  if (typeof body.body_text === 'string') {
    updates.body_text = body.body_text.trim().slice(0, 300);
    updates.copy = updates.body_text;
  }
  if (typeof body.destination_url === 'string') {
    const u = body.destination_url.trim();
    try {
      new URL(u);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }
    if (isProhibitedDestinationUrl(u)) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
    }
    updates.destination_url = u;
  }
  if (typeof body.image_url === 'string') updates.image_url = body.image_url.trim() || null;

  const nextTier = isPlacementTier(body.tier) ? body.tier : ex.tier;
  const nextBilling = isBillingCycle(body.billing_cycle) ? body.billing_cycle : ex.billing_cycle;
  if (isPlacementTier(nextTier) && isBillingCycle(nextBilling)) {
    updates.tier = nextTier;
    updates.billing_cycle = nextBilling;
    updates.format = formatForPlacementTier(nextTier);
    updates.annual_discount_applied = nextBilling === 'annual';
    const price = getCheckoutPriceGbp(nextTier, nextBilling);
    updates.price_gbp = price;
    updates.package_price_pence = Math.round(price * 100);
    updates.package_days = nextBilling === 'annual' ? 365 : 30;
  }

  const { error: upErr } = await service.from('advertisements').update(updates).eq('id', ad_id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
