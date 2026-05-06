import { NextRequest, NextResponse } from 'next/server';

const TIER_PRICES: Record<string, { pence: number; label: string; priceId?: string }> = {
  starter:      { pence: 1900, label: 'Starter — £19/month' },
  standard:     { pence: 3900, label: 'Standard — £39/month' },
  professional: { pence: 6900, label: 'Professional — £69/month' },
};

export async function POST(req: NextRequest) {
  const { tier, userId, email } = await req.json();

  const tierData = TIER_PRICES[tier];
  if (!tierData) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://groundviewnews.com';

  const params = new URLSearchParams({
    'payment_method_types[]': 'card',
    'line_items[0][price_data][currency]': 'gbp',
    'line_items[0][price_data][product_data][name]': tierData.label,
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][unit_amount]': String(tierData.pence),
    'line_items[0][quantity]': '1',
    mode: 'subscription',
    success_url: `${baseUrl}/journalists/dashboard?subscribed=1`,
    cancel_url: `${baseUrl}/journalists/register`,
    customer_email: email,
    'metadata[userId]': userId,
    'metadata[tier]': tier,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const session = await res.json();

  if (!res.ok || !session.url) {
    return NextResponse.json({ error: session.error?.message || 'Stripe error' }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
