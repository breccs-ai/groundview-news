import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getStripe,
  getMonthlyPriceId,
  getAnnualPriceId,
  siteBase,
  READER_SUBSCRIPTION_METADATA_KEY,
  READER_SUBSCRIPTION_METADATA_VALUE,
  type ReaderSubscriptionPlan,
} from '@/lib/stripe';

export const runtime = 'nodejs';

/**
 * POST /api/subscribe/create-checkout
 * Body: { plan: 'monthly' | 'annual', email?: string }
 *
 * Creates a Stripe Checkout Session for one of the two reader plans:
 *   - monthly: mode='subscription', price=£4.99/mo recurring
 *   - annual : mode='payment',      one-off £39
 *
 * Returns { url } — the caller redirects the browser to Stripe's hosted page.
 * Email is optional; if the visitor is already signed in, the client can pass
 * their address so it pre-fills in Checkout. If absent, Stripe will collect it.
 */
export async function POST(req: NextRequest) {
  let body: { plan?: ReaderSubscriptionPlan; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const plan = body?.plan;
  if (plan !== 'monthly' && plan !== 'annual') {
    return NextResponse.json({ error: 'plan must be "monthly" or "annual"' }, { status: 400 });
  }

  // Optional: tie the checkout to a signed-in reader if a Bearer token was
  // supplied. Lets the webhook attach the subscription to the existing
  // profile without an email lookup.
  let signedInUserId: string | null = null;
  let signedInEmail: string | null = null;
  const auth = req.headers.get('authorization');
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anonKey) {
      const supa = createClient(url, anonKey);
      const { data } = await supa.auth.getUser(token);
      if (data?.user) {
        signedInUserId = data.user.id;
        signedInEmail = data.user.email ?? null;
      }
    }
  }

  const customerEmail =
    (typeof body?.email === 'string' && body.email.trim()) || signedInEmail || undefined;

  let stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    console.error('[subscribe/create-checkout] stripe init', e);
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  try {
    const priceId = plan === 'monthly' ? await getMonthlyPriceId() : await getAnnualPriceId();

    const base = siteBase();
    const session = await stripe.checkout.sessions.create({
      mode: plan === 'monthly' ? 'subscription' : 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/api/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/subscribe?cancelled=1`,
      allow_promotion_codes: true,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      metadata: {
        [READER_SUBSCRIPTION_METADATA_KEY]: READER_SUBSCRIPTION_METADATA_VALUE,
        plan,
        ...(signedInUserId ? { gvn_user_id: signedInUserId } : {}),
      },
      // For monthly: forward the same metadata onto the subscription object,
      // so `customer.subscription.deleted` / `invoice.*` events can route
      // back to the reader-subscription handler without a session lookup.
      ...(plan === 'monthly'
        ? {
            subscription_data: {
              metadata: {
                [READER_SUBSCRIPTION_METADATA_KEY]: READER_SUBSCRIPTION_METADATA_VALUE,
                plan,
                ...(signedInUserId ? { gvn_user_id: signedInUserId } : {}),
              },
            },
          }
        : {}),
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a redirect URL' }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Checkout creation failed';
    console.error('[subscribe/create-checkout]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
