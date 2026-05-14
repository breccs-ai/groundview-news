import Stripe from 'stripe';
import OpenAI from 'openai';
import { getServiceSupabase } from '@/lib/supabase-service';
import { isProhibitedDestinationUrl } from '@/lib/advertiser/url-blocklist';
import { ad_live, ad_rejected } from '@/lib/emails/advertiser-emails';
import { getOneOffDurationDays, type AdFormat, type AdTier } from '@/lib/advertiser/pricing';

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

export type ValidateAdResult = { ok: true } | { ok: false; error: string };

export async function runAdvertisementValidation(advertisementId: string): Promise<ValidateAdResult> {
  const supabase = getServiceSupabase();
  const stripe = getStripe();
  if (!supabase || !stripe) {
    return { ok: false, error: 'Server misconfigured' };
  }

  const { data: ad, error } = await supabase
    .from('advertisements')
    .select(
      'id, title, body_text, destination_url, format, tier, status, ai_review_status, stripe_payment_intent_id, stripe_subscription_id, price_gbp, advertiser_id'
    )
    .eq('id', advertisementId)
    .maybeSingle();

  if (error || !ad) {
    return { ok: false, error: error?.message || 'Ad not found' };
  }

  const row = ad as Record<string, unknown>;
  if (row.ai_review_status === 'passed' && row.status === 'active') {
    return { ok: true };
  }

  const title = String(row.title || '');
  const bodyText = String(row.body_text || '');
  const destinationUrl = String(row.destination_url || '');
  const format = String(row.format || 'leaderboard_banner') as AdFormat;
  const tier = String(row.tier || 'one_off') as AdTier;
  const piId = typeof row.stripe_payment_intent_id === 'string' ? row.stripe_payment_intent_id : '';
  const subId = typeof row.stripe_subscription_id === 'string' ? row.stripe_subscription_id : '';
  const advertiserId = String(row.advertiser_id || '');

  const { data: prof } = await supabase
    .from('advertiser_profiles')
    .select('contact_name, email, company_name')
    .eq('id', advertiserId)
    .maybeSingle();

  const p = prof as { contact_name?: string; email?: string; company_name?: string } | null;
  const advertiserName = String(p?.contact_name || p?.company_name || 'Advertiser');
  const advertiserEmail = String(p?.email || '');

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

  const now = new Date();
  let expires: Date;
  if (tier === 'one_off') {
    const days = getOneOffDurationDays(format);
    expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  } else if (tier === 'monthly') {
    expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  } else {
    expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  }

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
      paid_at: now.toISOString(),
      price_paid: pricePaid,
      updated_at: now.toISOString(),
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
      ai_assessment: { source: 'advertiser_validate_ad', passed: true },
    });
    if (mqErr) {
      console.error('[validate-ad] moderation_queue', mqErr.message);
    }
  }

  if (advertiserEmail) {
    await ad_live(
      advertiserName,
      advertiserEmail,
      title,
      format,
      tier,
      now.toISOString(),
      expires.toISOString(),
      destinationUrl
    );
  }

  return { ok: true };
}

async function rejectAd(opts: {
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>;
  stripe: Stripe;
  advertisementId: string;
  reason: string;
  advertiserName: string;
  advertiserEmail: string;
  title: string;
  piId: string;
  subId: string;
}) {
  const { supabase, stripe, advertisementId, reason, advertiserName, advertiserEmail, title, piId, subId } = opts;
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
    await ad_rejected(advertiserName, advertiserEmail, title, reason);
  }
}
