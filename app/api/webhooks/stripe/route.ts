import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServiceSupabase } from '@/lib/supabase-service';
import { runAdvertisementValidation } from '@/lib/advertiser/validate-ad-internal';
import {
  renewal_confirmed,
  payment_failed,
  subscription_cancelled,
} from '@/lib/emails/advertiser-emails';

export const runtime = 'nodejs';

function getStripe(): Stripe | null {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) return null;
  return new Stripe(k);
}

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://groundviewnews.com').replace(/\/$/, '');
}

async function resolvePaymentIntentId(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<string | null> {
  const pi = session.payment_intent;
  if (typeof pi === 'string') return pi;
  if (pi && typeof pi === 'object' && 'id' in pi) return String((pi as Stripe.PaymentIntent).id);
  const subId = session.subscription;
  if (typeof subId !== 'string' || !subId) return null;
  const sub = await stripe.subscriptions.retrieve(subId, { expand: ['latest_invoice.payment_intent'] });
  const inv = sub.latest_invoice;
  if (!inv || typeof inv !== 'object') return null;
  const invObj = inv as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent | null };
  const p = invObj.payment_intent;
  if (typeof p === 'string') return p;
  if (p && typeof p === 'object' && 'id' in p) return String((p as Stripe.PaymentIntent).id);
  return null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = (invoice as unknown as { subscription?: string | Stripe.Subscription | null }).subscription;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'id' in raw) return (raw as Stripe.Subscription).id;
  return null;
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

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};
      const adId = typeof meta.ad_id === 'string' ? meta.ad_id : '';
      if (!adId) {
        return NextResponse.json({ received: true });
      }

      const piId = await resolvePaymentIntentId(stripe, session);
      const subId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription && typeof session.subscription === 'object'
            ? (session.subscription as Stripe.Subscription).id
            : null;

      const now = new Date().toISOString();
      await supabase
        .from('advertisements')
        .update({
          stripe_payment_intent_id: piId,
          stripe_subscription_id: subId,
          updated_at: now,
        })
        .eq('id', adId);

      await runAdvertisementValidation(adId);
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const { data: ad } = await supabase
        .from('advertisements')
        .select('id, ai_review_status, status')
        .eq('stripe_payment_intent_id', pi.id)
        .maybeSingle();

      const row = ad as { id: string; ai_review_status?: string; status?: string } | null;
      if (row && row.ai_review_status === 'pending' && row.status !== 'active') {
        await runAdvertisementValidation(row.id);
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.billing_reason === 'subscription_create') {
        return NextResponse.json({ received: true });
      }

      const subId = invoiceSubscriptionId(invoice);
      if (!subId) return NextResponse.json({ received: true });

      const { data: ad } = await supabase
        .from('advertisements')
        .select('id, title, tier, expires_at, renewal_count, advertiser_id')
        .eq('stripe_subscription_id', subId)
        .maybeSingle();

      if (!ad) return NextResponse.json({ received: true });

      const a = ad as Record<string, unknown>;
      const tier = String(a.tier || 'monthly');
      const addDays = tier === 'annual' ? 365 : 30;
      const prev = a.expires_at ? new Date(String(a.expires_at)) : new Date();
      const base = prev > new Date() ? prev : new Date();
      const nextExpiry = new Date(base.getTime() + addDays * 24 * 60 * 60 * 1000);
      const renewals = Number(a.renewal_count || 0) + 1;

      await supabase
        .from('advertisements')
        .update({
          status: 'active',
          expires_at: nextExpiry.toISOString(),
          ends_at: nextExpiry.toISOString(),
          renewal_count: renewals,
          updated_at: new Date().toISOString(),
        })
        .eq('id', String(a.id));

      const { data: prof } = await supabase
        .from('advertiser_profiles')
        .select('contact_name, email, company_name')
        .eq('id', String(a.advertiser_id))
        .maybeSingle();

      const p = prof as { contact_name?: string; email?: string; company_name?: string } | null;
      const name = String(p?.contact_name || p?.company_name || 'Advertiser');
      const email = String(p?.email || '');
      const amount = invoice.amount_paid != null ? (invoice.amount_paid / 100).toFixed(2) : '';
      const nextBill =
        typeof invoice.lines?.data?.[0]?.period?.end === 'number'
          ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
          : nextExpiry.toISOString();

      if (email) {
        await renewal_confirmed(
          name,
          email,
          String(a.title || 'Your ad'),
          tier,
          nextBill,
          `£${amount}`
        );
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = invoiceSubscriptionId(invoice);
      if (!subId) return NextResponse.json({ received: true });

      const { data: ad } = await supabase
        .from('advertisements')
        .select('id, title, advertiser_id')
        .eq('stripe_subscription_id', subId)
        .maybeSingle();

      const a = ad as { id: string; title?: string; advertiser_id: string } | null;
      if (!a) return NextResponse.json({ received: true });

      await supabase
        .from('advertisements')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', a.id);

      const { data: prof } = await supabase
        .from('advertiser_profiles')
        .select('contact_name, email, company_name, stripe_customer_id')
        .eq('id', a.advertiser_id)
        .maybeSingle();

      const p = prof as {
        contact_name?: string;
        email?: string;
        company_name?: string;
        stripe_customer_id?: string | null;
      } | null;

      const email = String(p?.email || '');
      const name = String(p?.contact_name || p?.company_name || 'Advertiser');
      const customerId = p?.stripe_customer_id;

      let portalUrl = `${siteBase()}/advertiser/dashboard`;
      if (customerId) {
        try {
          const portal = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${siteBase()}/advertiser/dashboard`,
          });
          portalUrl = portal.url;
        } catch (e) {
          console.error('[stripe webhook] portal', e);
        }
      }

      if (email) {
        await payment_failed(name, email, String(a.title || 'Your ad'), portalUrl);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const { data: ad } = await supabase
        .from('advertisements')
        .select('id, title, expires_at, advertiser_id')
        .eq('stripe_subscription_id', sub.id)
        .maybeSingle();

      const a = ad as { id: string; title?: string; expires_at?: string | null; advertiser_id: string } | null;
      if (!a) return NextResponse.json({ received: true });

      await supabase
        .from('advertisements')
        .update({
          status: 'cancelled',
          cancellation_requested: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', a.id);

      const { data: prof } = await supabase
        .from('advertiser_profiles')
        .select('contact_name, email, company_name')
        .eq('id', a.advertiser_id)
        .maybeSingle();

      const p = prof as { contact_name?: string; email?: string; company_name?: string } | null;
      const email = String(p?.email || '');
      const name = String(p?.contact_name || p?.company_name || 'Advertiser');
      const endsAt = a.expires_at ? String(a.expires_at) : new Date().toISOString();
      if (email) {
        await subscription_cancelled(name, email, String(a.title || 'Your ad'), endsAt);
      }
    }
  } catch (e) {
    console.error('[webhooks/stripe] handler error', e);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
