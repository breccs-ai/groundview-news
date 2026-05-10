import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function getStripe(): Stripe | null {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) return null;
  return new Stripe(k);
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** After moderation, ads use `pending_review` (ready for checkout). Also accept `pending` if used. */
function isAwaitingPayment(status: string) {
  return status === 'pending_review' || status === 'pending';
}

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const supabase = getServiceSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const advertiserId =
      typeof body.advertiser_id === 'string' ? body.advertiser_id.trim() : '';
    const adId = typeof body.ad_id === 'string' ? body.ad_id.trim() : '';
    const packageDays = Number(body.package_days);
    const packagePrice = Number(body.package_price);
    const adTitle =
      typeof body.ad_title === 'string' ? body.ad_title.trim() : 'Advertisement';
    const companyName =
      typeof body.company_name === 'string' ? body.company_name.trim() : '';

    if (!advertiserId || !adId || !Number.isFinite(packageDays) || packageDays <= 0) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
    }

    if (!Number.isFinite(packagePrice) || packagePrice < 1) {
      return NextResponse.json({ error: 'Invalid package_price' }, { status: 400 });
    }

    const { data: ad, error: adErr } = await supabase
      .from('advertisements')
      .select('id, user_id, status, company_name, title, package_days')
      .eq('id', adId)
      .maybeSingle();

    if (adErr) {
      return NextResponse.json({ error: adErr.message }, { status: 400 });
    }

    if (!ad) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 });
    }

    const row = ad as {
      user_id: string;
      status: string;
    };

    if (row.user_id !== advertiserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isAwaitingPayment(row.status)) {
      return NextResponse.json(
        { error: 'Ad is not awaiting payment' },
        { status: 400 }
      );
    }

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', advertiserId)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 400 });
    }

    const customerEmail =
      typeof (profile as { email?: string } | null)?.email === 'string'
        ? String((profile as { email: string }).email).trim()
        : undefined;

    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Advertiser email not found' },
        { status: 400 }
      );
    }

    const unitAmount = Math.round(packagePrice);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'gbp',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: adTitle || 'Advertisement',
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      success_url:
        'https://groundviewnews.com/advertise/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://groundviewnews.com/advertise/new?cancelled=true',
      metadata: {
        ad_id: adId,
        advertiser_id: advertiserId,
        package_days: String(packageDays),
      },
      customer_email: customerEmail,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Checkout session missing URL' },
        { status: 500 }
      );
    }

    await supabase
      .from('advertisements')
      .update({
        stripe_session_id: session.id,
        package_days: packageDays,
        package_price_pence: unitAmount,
        company_name: companyName || (ad as { company_name?: string }).company_name,
        title: adTitle || (ad as { title?: string }).title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adId);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (e) {
    console.error('[advertiser/checkout]', e);
    return NextResponse.json(
      { error: 'Could not create checkout session' },
      { status: 500 }
    );
  }
}
