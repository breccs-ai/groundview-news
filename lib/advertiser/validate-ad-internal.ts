import Stripe from 'stripe';
import OpenAI from 'openai';
import { getServiceSupabase } from '@/lib/supabase-service';
import { isProhibitedDestinationUrl } from '@/lib/advertiser/url-blocklist';
import { detectGamblingAd } from '@/lib/advertiser/gambling';
import { ad_live, ad_rejected, ad_under_review } from '@/lib/emails/advertiser-emails';
import { notifyOps } from '@/lib/ops-notifications';
import { escapeHtml, siteUrl } from '@/lib/email-branding';
import {
  getOneOffDurationDays,
  resolveBillingCycle,
  type AdFormat,
  type LegacyBillingTier,
} from '@/lib/advertiser/pricing';
import { formatForPlacementTier } from '@/lib/advertiser/placements';
import { isPlacementTier, type PlacementTier } from '@/lib/advertiser/pricing';

type Supabase = NonNullable<ReturnType<typeof getServiceSupabase>>;

function getStripe(): Stripe | null {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) return null;
  return new Stripe(k);
}

function moderationFailureReason(categories: Record<string, boolean>): string {
  const keys = Object.entries(categories)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const focus = ['hate', 'harassment', 'violence', 'sexual', 'self-harm', 'illicit'];
  const hit = keys.filter((k) => focus.some((f) => k.includes(f)));
  if (hit.length) return `Automated review flagged: ${hit.join(', ')}.`;
  return `Automated review flagged: ${keys.slice(0, 6).join(', ') || 'policy violation'}.`;
}

export type ValidateAdResult = { ok: true; held?: boolean } | { ok: false; error: string };

type AdContext = {
  supabase: Supabase;
  advertisementId: string;
  row: Record<string, unknown>;
  title: string;
  bodyText: string;
  destinationUrl: string;
  format: AdFormat;
  placementTier: PlacementTier | null;
  billingCycle: string;
  piId: string;
  subId: string;
  advertiserName: string;
  advertiserEmail: string;
};

async function loadAdContext(
  supabase: Supabase,
  advertisementId: string
): Promise<{ ok: true; ctx: AdContext } | { ok: false; error: string }> {
  const { data: ad, error } = await supabase
    .from('advertisements')
    .select(
      'id, title, body_text, destination_url, format, tier, billing_cycle, status, ai_review_status, stripe_payment_intent_id, stripe_subscription_id, price_gbp, annual_discount_applied, advertiser_id'
    )
    .eq('id', advertisementId)
    .maybeSingle();

  if (error || !ad) {
    return { ok: false, error: error?.message || 'Ad not found' };
  }

  const row = ad as Record<string, unknown>;
  const advertiserId = String(row.advertiser_id || '');

  const { data: prof } = await supabase
    .from('advertiser_profiles')
    .select('contact_name, email, company_name')
    .eq('id', advertiserId)
    .maybeSingle();

  const p = prof as { contact_name?: string; email?: string; company_name?: string } | null;

  return {
    ok: true,
    ctx: {
      supabase,
      advertisementId,
      row,
      title: String(row.title || ''),
      bodyText: String(row.body_text || ''),
      destinationUrl: String(row.destination_url || ''),
      format: String(row.format || 'leaderboard_banner') as AdFormat,
      placementTier: isPlacementTier(row.tier) ? (row.tier as PlacementTier) : null,
      billingCycle: resolveBillingCycle({
        billing_cycle: row.billing_cycle as string,
        tier: row.tier as string,
      }),
      piId: typeof row.stripe_payment_intent_id === 'string' ? row.stripe_payment_intent_id : '',
      subId: typeof row.stripe_subscription_id === 'string' ? row.stripe_subscription_id : '',
      advertiserName: String(p?.contact_name || p?.company_name || 'Advertiser'),
      advertiserEmail: String(p?.email || ''),
    },
  };
}

export async function runAdvertisementValidation(advertisementId: string): Promise<ValidateAdResult> {
  const supabase = getServiceSupabase();
  const stripe = getStripe();
  if (!supabase || !stripe) {
    return { ok: false, error: 'Server misconfigured' };
  }

  const loaded = await loadAdContext(supabase, advertisementId);
  if (!loaded.ok) return loaded;
  const ctx = loaded.ctx;
  const { row, title, bodyText, destinationUrl, piId, subId, advertiserName, advertiserEmail } = ctx;

  if (row.ai_review_status === 'passed' && row.status === 'active') {
    return { ok: true };
  }
  // Already held for manual approval: only an admin decision moves it on, so a
  // repeated webhook or validation call must not touch it.
  if (row.ai_review_status === 'manual_review' && row.status === 'pending_review') {
    return { ok: true, held: true };
  }

  if (isProhibitedDestinationUrl(destinationUrl)) {
    await rejectAd({
      supabase,
      stripe,
      advertisementId,
      reason: 'Destination URL is not allowed (blocked or invalid).',
      advertiserName,
      advertiserEmail,
      title,
      piId,
      subId,
    });
    return { ok: false, error: 'blocked_url' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[validate-ad] OPENAI_API_KEY missing — failing closed');
    await rejectAd({
      supabase,
      stripe,
      advertisementId,
      reason: 'Content review service unavailable. Payment will be refunded.',
      advertiserName,
      advertiserEmail,
      title,
      piId,
      subId,
    });
    return { ok: false, error: 'no_openai' };
  }

  const openai = new OpenAI({ apiKey });
  const input = `${title}\n${bodyText}`.trim() || title;
  const mod = await openai.moderations.create({ input });

  const result = mod.results[0];
  if (!result) {
    await rejectAd({
      supabase,
      stripe,
      advertisementId,
      reason: 'Content review returned no result. Payment will be refunded.',
      advertiserName,
      advertiserEmail,
      title,
      piId,
      subId,
    });
    return { ok: false, error: 'no_mod_result' };
  }
  if (result.flagged) {
    const reason = moderationFailureReason(result.categories as unknown as Record<string, boolean>);
    await rejectAd({
      supabase,
      stripe,
      advertisementId,
      reason,
      advertiserName,
      advertiserEmail,
      title,
      piId,
      subId,
    });
    return { ok: false, error: 'moderation' };
  }

  // Gambling advertising never goes live automatically. It passed the content
  // checks above, so it is held (paid, not shown) until an admin approves or
  // rejects it from the admin dashboard.
  const gambling = detectGamblingAd({ title, bodyText, destinationUrl });
  if (gambling.matched) {
    return holdForGamblingReview(ctx, gambling.signals);
  }

  return activateAd(ctx);
}

function computeExpiry(billingCycle: string, format: AdFormat, now: Date): Date {
  if (billingCycle === 'one_off') {
    const days = getOneOffDurationDays(format);
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }
  if (billingCycle === 'monthly') {
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
}

async function activateAd(ctx: AdContext, overrideReason?: string): Promise<ValidateAdResult> {
  const { supabase, advertisementId, row, title, destinationUrl, format, placementTier, billingCycle } = ctx;

  const now = new Date();
  const expires = computeExpiry(billingCycle, format, now);
  const expiryDate = expires.toISOString().slice(0, 10);

  const pricePaid = row.price_gbp != null ? Number(row.price_gbp) : null;

  const { error: upErr } = await supabase
    .from('advertisements')
    .update({
      ai_review_status: 'passed',
      ai_review_reason: null,
      status: 'active',
      starts_at: now.toISOString(),
      expires_at: expires.toISOString(),
      ends_at: expires.toISOString(),
      expiry_date: expiryDate,
      format: placementTier ? formatForPlacementTier(placementTier) : format,
      paid_at: now.toISOString(),
      price_paid: pricePaid,
      updated_at: now.toISOString(),
      ...(overrideReason
        ? { admin_override_reason: overrideReason, admin_override_at: now.toISOString() }
        : {}),
    })
    .eq('id', advertisementId);

  if (upErr) {
    console.error('[validate-ad] update', upErr.message);
    return { ok: false, error: upErr.message };
  }

  if (format === 'sponsored_article') {
    const { error: mqErr } = await supabase.from('moderation_queue').insert({
      advertisement_id: advertisementId,
      status: 'approved',
      is_sponsored: true,
      ai_assessment: overrideReason
        ? { source: 'admin_manual_approval', passed: true }
        : { source: 'advertiser_validate_ad', passed: true },
    });
    if (mqErr) {
      console.error('[validate-ad] moderation_queue', mqErr.message);
    }
  }

  if (ctx.advertiserEmail) {
    await ad_live(
      ctx.advertiserName,
      ctx.advertiserEmail,
      title,
      format,
      placementTier || billingCycle,
      now.toISOString(),
      expires.toISOString(),
      destinationUrl
    );
  }

  return { ok: true };
}

async function holdForGamblingReview(ctx: AdContext, signals: string[]): Promise<ValidateAdResult> {
  const { supabase, advertisementId, title, destinationUrl, advertiserName, advertiserEmail } = ctx;

  const { error } = await supabase
    .from('advertisements')
    .update({
      status: 'pending_review',
      ai_review_status: 'manual_review',
      ai_review_reason: `Gambling advertising: held for manual approval (matched: ${signals.join(', ')}).`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', advertisementId);

  if (error) {
    console.error('[validate-ad] gambling hold', error.message);
    return { ok: false, error: error.message };
  }

  if (advertiserEmail) {
    await ad_under_review(advertiserName, advertiserEmail, title);
  }

  await notifyOps(
    `Gambling ad held for manual approval: ${title}`,
    `<p>A gambling advertisement has been paid for and is being held. It will not go live until you approve it.</p>
<p><strong>Advertiser:</strong> ${escapeHtml(advertiserName)}<br/>
<strong>Title:</strong> ${escapeHtml(title)}<br/>
<strong>Destination:</strong> ${escapeHtml(destinationUrl)}<br/>
<strong>Matched on:</strong> ${escapeHtml(signals.join(', '))}</p>
<p>Review it in the <a href="${siteUrl()}/admin/dashboard">admin dashboard</a> (Advertisements, filter: pending_review). Before approving, check the advertiser holds the licence required for the audience they are targeting.</p>`
  );

  return { ok: true, held: true };
}

type HeldResult = { ok: true } | { ok: false; error: string };

async function loadHeldAd(advertisementId: string): Promise<
  { ok: true; ctx: AdContext } | { ok: false; error: string }
> {
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, error: 'Server misconfigured' };
  const loaded = await loadAdContext(supabase, advertisementId);
  if (!loaded.ok) return loaded;
  const { row } = loaded.ctx;
  if (row.status !== 'pending_review' || row.ai_review_status !== 'manual_review') {
    return { ok: false, error: 'Ad is not awaiting manual approval.' };
  }
  return loaded;
}

/** Admin approval of a held gambling ad: activates it exactly as automatic approval would. */
export async function approveHeldAdvertisement(
  advertisementId: string,
  reason: string
): Promise<HeldResult> {
  const held = await loadHeldAd(advertisementId);
  if (!held.ok) return held;
  const result = await activateAd(held.ctx, reason);
  return result.ok ? { ok: true } : result;
}

/** Admin rejection of a held gambling ad: rejects it, refunds the payment and emails the advertiser. */
export async function rejectHeldAdvertisement(
  advertisementId: string,
  reason: string
): Promise<HeldResult> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: 'Server misconfigured' };
  const held = await loadHeldAd(advertisementId);
  if (!held.ok) return held;
  const { ctx } = held;
  await rejectAd({
    supabase: ctx.supabase,
    stripe,
    advertisementId,
    reason,
    advertiserName: ctx.advertiserName,
    advertiserEmail: ctx.advertiserEmail,
    title: ctx.title,
    piId: ctx.piId,
    subId: ctx.subId,
    manual: true,
  });
  return { ok: true };
}

async function rejectAd(opts: {
  supabase: Supabase;
  stripe: Stripe;
  advertisementId: string;
  reason: string;
  advertiserName: string;
  advertiserEmail: string;
  title: string;
  piId: string;
  subId: string;
  manual?: boolean;
}) {
  const { supabase, stripe, advertisementId, reason, advertiserName, advertiserEmail, title, piId, subId, manual } = opts;
  const now = new Date().toISOString();

  await supabase
    .from('advertisements')
    .update({
      ai_review_status: 'failed',
      status: 'rejected',
      ai_review_reason: reason,
      updated_at: now,
    })
    .eq('id', advertisementId);

  let refundPi = piId;
  if (!refundPi && subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId, { expand: ['latest_invoice.payment_intent'] });
      const invRaw = sub.latest_invoice;
      if (invRaw && typeof invRaw === 'object') {
        const inv = invRaw as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent | null };
        const pi = inv.payment_intent;
        refundPi = typeof pi === 'string' ? pi : pi?.id || '';
      }
      await stripe.subscriptions.cancel(subId);
    } catch (e) {
      console.error('[validate-ad] subscription cancel/refund prep', e);
    }
  }

  if (refundPi) {
    try {
      await stripe.refunds.create({ payment_intent: refundPi });
    } catch (e) {
      console.error('[validate-ad] refund failed', e);
    }
  }

  if (advertiserEmail) {
    await ad_rejected(advertiserName, advertiserEmail, title, reason, manual);
  }
}
