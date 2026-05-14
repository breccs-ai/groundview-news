import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServiceSupabase } from '@/lib/supabase-service';
import { AD_PRICING, type AdFormat, type AdTier, getAdPriceGbp } from '@/lib/advertiser/pricing';
import { isProhibitedDestinationUrl } from '@/lib/advertiser/url-blocklist';

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

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://groundviewnews.com').replace(/\/$/, '');
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
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const adId = typeof body.ad_id === 'string' ? body.ad_id.trim() : '';
  const format = body.format as AdFormat;
  const tier = body.tier as AdTier;

  if (!adId || !AD_PRICING[format] || !AD_PRICING[format][tier]) {
    return NextResponse.json({ error: 'Invalid ad, format, or tier' }, { status: 400 });
  }

  const { data: ad, error: adErr } = await service
    .from('advertisements')
    .select('id, advertiser_id, status, destination_url')
    .eq('id', adId)
    .maybeSingle();

  if (adErr || !ad) {
    return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
  }

  const row = ad as { advertiser_id: string; status: string; destination_url?: string };
  const { data: ap } = await service
    .from('advertiser_profiles')
    .select('id, user_id, kyc_status, stripe_customer_id, email')
    .eq('id', row.advertiser_id)
    .maybeSingle();

  const prof = ap as { id: string; user_id: string; kyc_status: string; stripe_customer_id: string | null; email: string } | null;
  if (!prof || prof.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (prof.kyc_status !== 'verified') {
    return NextResponse.json({ error: 'Identity verification required before payment' }, { status: 403 });
  }
  if (row.status !== 'pending_payment' && row.status !== 'pending_review') {
    return NextResponse.json({ error: 'Ad is not awaiting payment' }, { status: 400 });
  }
  if (row.destination_url && isProhibitedDestinationUrl(row.destination_url)) {
    return NextResponse.json({ error: 'Destination URL is not allowed' }, { status: 400 });
  }

  const priceGbp = getAdPriceGbp(format, tier);
  const unitAmount = Math.round(priceGbp * 100);
  const base = siteBase();

  const customerId = prof.stripe_customer_id || undefined;
  if (!customerId) {
    return NextResponse.json({ error: 'Missing Stripe customer' }, { status: 400 });
  }

  const meta = {
    ad_id: adId,
    advertiser_profile_id: prof.id,
    format,
    tier,
  } as Record<string, string>;

  if (tier === 'one_off') {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      currency: 'gbp',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            unit_amount: unitAmount,
            product_data: { name: AD_PRICING[format][tier].label },
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/advertiser/create-ad?step=3&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/advertiser/create-ad?cancelled=1`,
      metadata: meta,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'No checkout URL' }, { status: 500 });
    }

    await service
      .from('advertisements')
      .update({
        format,
        tier,
        price_gbp: priceGbp,
        stripe_session_id: session.id,
        status: 'pending_review',
        updated_at: new Date().toISOString(),
      })
      .eq('id', adId);

    return NextResponse.json({ url: session.url, session_id: session.id });
  }

  const interval: Stripe.Price.Recurring.Interval = tier === 'monthly' ? 'month' : 'year';
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    currency: 'gbp',
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          unit_amount: unitAmount,
          recurring: { interval },
          product_data: { name: AD_PRICING[format][tier].label },
        },
        quantity: 1,
      },
    ],
    success_url: `${base}/advertiser/create-ad?step=3&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/advertiser/create-ad?cancelled=1`,
    metadata: meta,
    subscription_data: {
      metadata: meta,
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: 'No checkout URL' }, { status: 500 });
  }

  await service
    .from('advertisements')
    .update({
      format,
      tier,
      price_gbp: priceGbp,
      stripe_session_id: session.id,
      status: 'pending_review',
      updated_at: new Date().toISOString(),
    })
    .eq('id', adId);

  return NextResponse.json({ url: session.url, session_id: session.id });
}
