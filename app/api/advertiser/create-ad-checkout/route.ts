import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServiceSupabase } from '@/lib/supabase-service';
import {
  AD_PRICING,
  getCheckoutPriceGbp,
  isBillingCycle,
  isPlacementTier,
  type AdFormat,
  type BillingCycle,
  type LegacyBillingTier,
  type PlacementTier,
  getAdPriceGbp,
  TIER_PRICING,
} from '@/lib/advertiser/pricing';
import { formatForPlacementTier } from '@/lib/advertiser/placements';
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

function checkoutLabel(placementTier: PlacementTier, billingCycle: BillingCycle): string {
  const name = TIER_PRICING[placementTier].shortLabel;
  return billingCycle === 'monthly'
    ? `${name} — Monthly`
    : `${name} — Annual (upfront)`;
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
  const placementTier = body.tier as PlacementTier;
  const billingCycle = body.billing_cycle as BillingCycle;
  const legacyFormat = body.format as AdFormat | undefined;
  const legacyTier = body.tier as LegacyBillingTier | undefined;

  const useNewModel = isPlacementTier(placementTier) && isBillingCycle(billingCycle);
  const useLegacy =
    !useNewModel &&
    legacyFormat &&
    legacyTier &&
    AD_PRICING[legacyFormat] &&
    AD_PRICING[legacyFormat][legacyTier as LegacyBillingTier];

  if (!adId || (!useNewModel && !useLegacy)) {
    return NextResponse.json({ error: 'Invalid ad, tier, or billing cycle' }, { status: 400 });
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

  const prof = ap as {
    id: string;
    user_id: string;
    kyc_status: string;
    stripe_customer_id: string | null;
    email: string;
  } | null;
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

  const customerId = prof.stripe_customer_id || undefined;
  if (!customerId) {
    return NextResponse.json({ error: 'Missing Stripe customer' }, { status: 400 });
  }

  const base = siteBase();
  let priceGbp: number;
  let productName: string;
  let format: string;
  let tierStored: string;
  let billing_cycle: string;
  let annual_discount_applied = false;

  if (useNewModel) {
    priceGbp = getCheckoutPriceGbp(placementTier, billingCycle);
    productName = checkoutLabel(placementTier, billingCycle);
    format = formatForPlacementTier(placementTier);
    tierStored = placementTier;
    billing_cycle = billingCycle;
    annual_discount_applied = billingCycle === 'annual';
  } else {
    const lf = legacyFormat as AdFormat;
    format = lf;
    const lt = legacyTier as LegacyBillingTier;
    priceGbp = getAdPriceGbp(lf, lt);
    productName = AD_PRICING[lf][lt].label;
    tierStored = lt;
    billing_cycle = lt;
  }

  const unitAmount = Math.round(priceGbp * 100);
  const meta = {
    ad_id: adId,
    advertiser_profile_id: prof.id,
    format,
    tier: tierStored,
    billing_cycle,
  } as Record<string, string>;

  const updatePayload = {
    format,
    tier: tierStored,
    billing_cycle,
    annual_discount_applied,
    price_gbp: priceGbp,
    stripe_session_id: '' as string,
    status: 'pending_review',
    updated_at: new Date().toISOString(),
  };

  if (useLegacy && legacyTier === 'one_off') {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      currency: 'gbp',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            unit_amount: unitAmount,
            product_data: { name: productName },
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

    updatePayload.stripe_session_id = session.id;
    await service.from('advertisements').update(updatePayload).eq('id', adId);
    return NextResponse.json({ url: session.url, session_id: session.id });
  }

  if (useNewModel && billingCycle === 'annual') {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      currency: 'gbp',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            unit_amount: unitAmount,
            product_data: { name: productName },
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

    updatePayload.stripe_session_id = session.id;
    await service.from('advertisements').update(updatePayload).eq('id', adId);
    return NextResponse.json({ url: session.url, session_id: session.id });
  }

  const interval: Stripe.Price.Recurring.Interval =
    useLegacy && legacyTier === 'annual' ? 'year' : 'month';
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
          product_data: { name: productName },
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

  updatePayload.stripe_session_id = session.id;
  await service.from('advertisements').update(updatePayload).eq('id', adId);

  return NextResponse.json({ url: session.url, session_id: session.id });
}
