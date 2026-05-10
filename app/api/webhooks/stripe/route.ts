import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !sig) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (e) {
    console.error('[webhooks/stripe] Invalid signature', e);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata || {};
    const adId = typeof meta.ad_id === 'string' ? meta.ad_id : '';
    const advertiserId = typeof meta.advertiser_id === 'string' ? meta.advertiser_id : '';
    const packageDays = parseInt(String(meta.package_days || '0'), 10);

    if (!adId || !advertiserId || !Number.isFinite(packageDays) || packageDays <= 0) {
      console.warn('[webhooks/stripe] checkout.session.completed missing metadata', meta);
      return NextResponse.json({ received: true });
    }

    const supabase = getServiceSupabase();
    if (!supabase) {
      console.error('[webhooks/stripe] No service role');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const pi = session.payment_intent;
    let stripePaymentIntentId: string | null = null;
    if (typeof pi === 'string') {
      stripePaymentIntentId = pi;
    } else if (pi && typeof pi === 'object' && 'id' in pi) {
      stripePaymentIntentId = String((pi as Stripe.PaymentIntent).id);
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + packageDays * 24 * 60 * 60 * 1000);

    const { data: ad, error: upErr } = await supabase
      .from('advertisements')
      .update({
        status: 'active',
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        stripe_payment_intent_id: stripePaymentIntentId,
        updated_at: now.toISOString(),
      })
      .eq('id', adId)
      .select('id, title, company_name, user_id, package_price_pence')
      .maybeSingle();

    if (upErr) {
      console.error('[webhooks/stripe] update ad', upErr.message);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    if (!ad) {
      return NextResponse.json({ received: true });
    }

    const row = ad as {
      title?: string;
      company_name?: string;
      package_price_pence?: number;
    };

    const adTitle = String(row.title || 'your advertisement');
    const companyName = String(row.company_name || '');

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', advertiserId)
      .maybeSingle();

    const advertiserEmail = (profile as { email?: string } | null)?.email;

    const amountPence =
      typeof session.amount_total === 'number' && session.amount_total > 0
        ? session.amount_total
        : Number(row.package_price_pence) || 0;
    const amountGbp = (amountPence / 100).toFixed(2);

    const endsFormatted = endsAt.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    if (advertiserEmail) {
      await sendEmail(
        advertiserEmail,
        'Your Ground View News ad is now live',
        `<p>Your advertisement '${escapeHtml(adTitle)}' is now live on Ground View News. It will run for ${packageDays} days until ${escapeHtml(
          endsFormatted
        )}. You can view your ad performance at <a href="https://groundviewnews.com/advertise/dashboard">groundviewnews.com/advertise/dashboard</a>.</p>`
      );
    }

    await sendEmail(
      'advertising@groundviewnews.com',
      `New ad payment received: ${escapeHtml(companyName || adTitle)}`,
      `<p><strong>Company:</strong> ${escapeHtml(companyName)}</p>
<p><strong>Ad title:</strong> ${escapeHtml(adTitle)}</p>
<p><strong>Package:</strong> ${packageDays} days</p>
<p><strong>Amount paid:</strong> £${amountGbp}</p>
<p><strong>Starts:</strong> ${escapeHtml(now.toISOString())}</p>
<p><strong>Ends:</strong> ${escapeHtml(endsAt.toISOString())}</p>
<p><strong>Ad ID:</strong> ${escapeHtml(adId)}</p>
<p><strong>Stripe session:</strong> ${escapeHtml(session.id)}</p>`
    );
  }

  return NextResponse.json({ received: true });
}
