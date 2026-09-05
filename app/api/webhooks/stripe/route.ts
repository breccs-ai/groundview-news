import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServiceSupabase } from '@/lib/supabase-service';
import { runAdvertisementValidation } from '@/lib/advertiser/validate-ad-internal';
import {
  renewal_confirmed,
  payment_failed,
  subscription_cancelled,
} from '@/lib/emails/advertiser-emails';
import { computeExpiry, getProfileByEmail } from '@/lib/subscription';
import { READER_SUBSCRIPTION_METADATA_VALUE } from '@/lib/stripe';
import { notifyOps } from '@/lib/ops-notifications';
import { escapeHtml } from '@/lib/email-branding';

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

      // Reader-subscription flow (Part 3 of the monetisation layer).
      // Keyed on metadata.purpose so it never interferes with the existing
      // advertiser/journalist checkout flows.
      if (meta.purpose === READER_SUBSCRIPTION_METADATA_VALUE) {
        await handleReaderCheckoutCompleted(stripe, supabase, session);
        return NextResponse.json({ received: true });
      }

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

      // Route reader-subscription renewals separately. We only extend the
      // expiry — no advertiser-style email is sent here.
      const handledReader = await handleReaderInvoicePaid(stripe, supabase, subId);
      if (handledReader) return NextResponse.json({ received: true });

      const { data: ad } = await supabase
        .from('advertisements')
        .select('id, title, tier, billing_cycle, expires_at, renewal_count, advertiser_id')
        .eq('stripe_subscription_id', subId)
        .maybeSingle();

      if (!ad) return NextResponse.json({ received: true });

      const a = ad as Record<string, unknown>;
      const billing =
        typeof a.billing_cycle === 'string' && a.billing_cycle
          ? String(a.billing_cycle)
          : String(a.tier || 'monthly');
      const addDays = billing === 'annual' ? 365 : 30;
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
          expiry_date: nextExpiry.toISOString().slice(0, 10),
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
          billing,
          nextBill,
          `£${amount}`
        );
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = invoiceSubscriptionId(invoice);
      if (!subId) return NextResponse.json({ received: true });

      // Reader-subscription past-due handling: flip the profile flag and
      // exit before the advertiser branch runs.
      const handledReader = await handleReaderInvoicePaymentFailed(stripe, supabase, subId);
      if (handledReader) return NextResponse.json({ received: true });

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

      // Reader-subscription cancellation: routed by sub.metadata.purpose
      // (set on the original Checkout session). Falls back to the advertiser
      // path when no reader profile is found.
      const handledReader = await handleReaderSubscriptionDeleted(supabase, sub);
      if (handledReader) return NextResponse.json({ received: true });

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

// ---------------------------------------------------------------------------
// Reader subscription helpers (Part 3 of the monetisation layer)
// ---------------------------------------------------------------------------

type ReaderSupabase = NonNullable<ReturnType<typeof getServiceSupabase>>;

/**
 * Resolve which auth.users row the subscription belongs to. Priority order:
 *   1. metadata.gvn_user_id (set if the buyer was signed in at checkout)
 *   2. existing profiles row matching the buyer email
 *   3. provision a brand-new auth user + profile via the admin API
 *
 * Returns null on hard failure; otherwise the resolved user id is suitable
 * for use as a profile primary key.
 */
async function resolveReaderUserId(
  supabase: ReaderSupabase,
  email: string,
  metadataUserId?: string,
): Promise<string | null> {
  if (metadataUserId) return metadataUserId;
  const trimmed = email.trim();
  if (!trimmed) return null;

  const existing = await getProfileByEmail(supabase, trimmed);
  if (existing) return existing.id;

  // Anonymous checkout flow: provision an auth user so the subscription has
  // a profile row to attach to. email_confirm:true so the reader can sign
  // in via Supabase's magic-link flow without a separate verification step.
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: trimmed,
      email_confirm: true,
    });
    if (error) {
      console.error('[stripe webhook] auth.admin.createUser failed', error);
      return null;
    }
    const newId = data.user?.id ?? null;
    if (!newId) return null;

    // Ensure a profile row exists. ON CONFLICT is overkill — profiles.id FK
    // cascades from auth.users so no row exists yet for this id.
    await supabase
      .from('profiles')
      .upsert(
        {
          id: newId,
          email: trimmed,
          role: 'reader',
          subscription_status: 'free',
        },
        { onConflict: 'id' },
      );

    return newId;
  } catch (e) {
    console.error('[stripe webhook] reader provision error', e);
    return null;
  }
}

async function handleReaderCheckoutCompleted(
  stripe: Stripe,
  supabase: ReaderSupabase,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const meta = session.metadata || {};
  const plan: 'monthly' | 'annual' = meta.plan === 'annual' ? 'annual' : 'monthly';
  const email =
    (typeof session.customer_details?.email === 'string' && session.customer_details.email) ||
    (typeof session.customer_email === 'string' && session.customer_email) ||
    '';

  const userId = await resolveReaderUserId(
    supabase,
    email,
    typeof meta.gvn_user_id === 'string' ? meta.gvn_user_id : undefined,
  );
  if (!userId) {
    console.warn('[stripe webhook] reader checkout: no user id resolved', { email });
    return;
  }

  const startedAt = new Date();
  const expiresAt = computeExpiry(plan, startedAt);

  // For monthly: capture the subscription id so future invoice events route
  // back via stripe_subscription_id.
  const subId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription && typeof session.subscription === 'object'
        ? (session.subscription as Stripe.Subscription).id
        : null;
  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer && typeof session.customer === 'object'
        ? (session.customer as Stripe.Customer).id
        : null;

  await supabase
    .from('profiles')
    .update({
      subscription_status: 'active',
      subscription_plan: plan,
      subscription_started_at: startedAt.toISOString(),
      subscription_expires_at: expiresAt.toISOString(),
      ...(customerId ? { stripe_customer_id: customerId } : {}),
      ...(subId ? { stripe_subscription_id: subId } : {}),
    })
    .eq('id', userId);

  await notifyOps(
    `New reader subscription: ${plan}`,
    `<p>${escapeHtml(email || userId)} started a <strong>${escapeHtml(plan)}</strong> reader subscription.</p>
<p><strong>Expires:</strong> ${escapeHtml(expiresAt.toISOString())}</p>`
  );
}

async function handleReaderInvoicePaid(
  stripe: Stripe,
  supabase: ReaderSupabase,
  subId: string,
): Promise<boolean> {
  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subId);
  } catch {
    return false;
  }
  const purpose = sub.metadata?.purpose;
  if (purpose !== READER_SUBSCRIPTION_METADATA_VALUE) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, subscription_expires_at')
    .eq('stripe_subscription_id', subId)
    .maybeSingle();

  const row = profile as { id: string; subscription_expires_at: string | null } | null;
  if (!row) return true; // routed correctly, just nothing to update

  // Extend expiry from the later of "now" and the current expiry. Monthly
  // only — annual is a one-off payment and never produces invoice.paid renewals.
  const baseDate = row.subscription_expires_at
    ? new Date(row.subscription_expires_at)
    : new Date();
  const from = baseDate.getTime() > Date.now() ? baseDate : new Date();
  const nextExpiry = computeExpiry('monthly', from);

  await supabase
    .from('profiles')
    .update({
      subscription_status: 'active',
      subscription_expires_at: nextExpiry.toISOString(),
    })
    .eq('id', row.id);

  return true;
}

async function handleReaderInvoicePaymentFailed(
  stripe: Stripe,
  supabase: ReaderSupabase,
  subId: string,
): Promise<boolean> {
  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subId);
  } catch {
    return false;
  }
  if (sub.metadata?.purpose !== READER_SUBSCRIPTION_METADATA_VALUE) return false;

  await supabase
    .from('profiles')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_subscription_id', subId);

  return true;
}

async function handleReaderSubscriptionDeleted(
  supabase: ReaderSupabase,
  sub: Stripe.Subscription,
): Promise<boolean> {
  if (sub.metadata?.purpose !== READER_SUBSCRIPTION_METADATA_VALUE) return false;

  await supabase
    .from('profiles')
    .update({ subscription_status: 'cancelled' })
    .eq('stripe_subscription_id', sub.id);

  return true;
}
