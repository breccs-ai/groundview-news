import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { getAdPriceGbp, type AdFormat, type AdTier, getOneOffDurationDays, AD_PRICING } from '@/lib/advertiser/pricing';
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
  const format = body.format as AdFormat;
  const tier = body.tier as AdTier;

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
  if (!AD_PRICING[format] || !AD_PRICING[format][tier]) {
    return NextResponse.json({ error: 'Invalid format or tier' }, { status: 400 });
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

  const priceGbp = getAdPriceGbp(format, tier);
  const oneOffDays = tier === 'one_off' ? getOneOffDurationDays(format) : 30;
  const package_price_pence = Math.round(priceGbp * 100);

  const { data: inserted, error: insErr } = await service
    .from('advertisements')
    .insert({
      user_id: user.id,
      advertiser_id: pr.id,
      company_name: pr.company_name,
      title,
      copy: body_text,
      body_text,
      destination_url,
      image_url: image_url || null,
      format,
      tier,
      price_gbp: priceGbp,
      package_days: oneOffDays,
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

  const { data: existing } = await service.from('advertisements').select('id, advertiser_id, status').eq('id', ad_id).maybeSingle();

  const ex = existing as { advertiser_id: string; status: string } | null;
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
  if (body.format && AD_PRICING[body.format as AdFormat]) updates.format = body.format;
  if (body.tier && ['one_off', 'monthly', 'annual'].includes(body.tier)) {
    updates.tier = body.tier;
    const f = (updates.format || body.format) as AdFormat;
    const t = body.tier as AdTier;
    if (AD_PRICING[f]?.[t]) {
      updates.price_gbp = getAdPriceGbp(f, t);
      updates.package_price_pence = Math.round(getAdPriceGbp(f, t) * 100);
      updates.package_days = t === 'one_off' ? getOneOffDurationDays(f) : 30;
    }
  }

  const { error: upErr } = await service.from('advertisements').update(updates).eq('id', ad_id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
