import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PACKAGES: Record<number, { pence: number; label: string }> = {
  7:  { pence: 5900,  label: '7-day Ad Package' },
  14: { pence: 9900,  label: '14-day Ad Package' },
  30: { pence: 17900, label: '30-day Ad Package' },
  60: { pence: 29900, label: '60-day Ad Package' },
  90: { pence: 39900, label: '90-day Ad Package' },
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  const { adId, packageDays } = await req.json();

  const pkg = PACKAGES[packageDays as number];
  if (!adId || !pkg) {
    return NextResponse.json({ error: 'Invalid adId or package' }, { status: 400 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://groundviewnews.com';

  const params = new URLSearchParams({
    'payment_method_types[]': 'card',
    'line_items[0][price_data][currency]': 'gbp',
    'line_items[0][price_data][product_data][name]': pkg.label,
    'line_items[0][price_data][unit_amount]': String(pkg.pence),
    'line_items[0][quantity]': '1',
    mode: 'payment',
    success_url: `${baseUrl}/advertise/dashboard?payment=success`,
    cancel_url: `${baseUrl}/advertise/new?draft=${adId}`,
    'metadata[adId]': adId,
    'metadata[packageDays]': String(packageDays),
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

  const supabase = getSupabase();
  await supabase.from('advertisements')
    .update({ stripe_session_id: session.id, package_price_pence: pkg.pence, updated_at: new Date().toISOString() })
    .eq('id', adId);

  return NextResponse.json({ url: session.url });
}
