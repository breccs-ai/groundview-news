/**
 * Supabase Edge Function: ad-expiry-reminders
 *
 * Schedule daily via Supabase Dashboard → Edge Functions → Cron, or pg_cron calling
 * `POST https://<project>.supabase.co/functions/v1/ad-expiry-reminders` with
 * `Authorization: Bearer <service_role_or_function_secret>`.
 *
 * Env (set in Supabase function secrets): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * RESEND_API_KEY, STRIPE_SECRET_KEY (optional, for subscription renewal reminders).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const SITE = 'https://groundviewnews.com';

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

async function sendResend(to: string, subject: string, html: string): Promise<void> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) {
    console.warn('RESEND_API_KEY missing');
    return;
  }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Ground View News <info@groundviewnews.com>',
      to,
      subject,
      html,
    }),
  });
}

async function stripeGetSubscription(subId: string): Promise<{ current_period_end?: number } | null> {
  const sk = Deno.env.get('STRIPE_SECRET_KEY');
  if (!sk) return null;
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
    headers: { Authorization: `Bearer ${sk}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { current_period_end?: number };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env' }), { status: 500 });
  }

  const supabase = createClient(url, key);
  const now = new Date();

  const { data: oneOffAds } = await supabase
    .from('advertisements')
    .select('id, title, expires_at, advertiser_id')
    .eq('status', 'active')
    .eq('tier', 'one_off');

  let reminders = 0;
  let expired = 0;

  for (const ad of oneOffAds || []) {
    const row = ad as { id: string; title: string; expires_at: string | null; advertiser_id: string };
    if (!row.expires_at) continue;
    const exp = new Date(row.expires_at);
    const d = daysBetween(now, exp);
    if (d < 0) {
      const { data: expiredLog } = await supabase
        .from('ad_reminder_log')
        .select('id')
        .eq('advertisement_id', row.id)
        .eq('reminder_type', 'expired')
        .maybeSingle();
      if (!expiredLog) {
        await supabase.from('advertisements').update({ status: 'expired', updated_at: now.toISOString() }).eq('id', row.id);
        const { data: prof } = await supabase
          .from('advertiser_profiles')
          .select('email, contact_name, company_name')
          .eq('id', row.advertiser_id)
          .maybeSingle();
        const p = prof as { email?: string; contact_name?: string; company_name?: string } | null;
        const email = String(p?.email || '');
        if (email) {
          await sendResend(
            email,
            'Your Ground View News advertisement has expired',
            `<p>Hello ${p?.contact_name || p?.company_name || 'there'},</p><p>Your ad <strong>${row.title}</strong> has expired.</p><p><a href="${SITE}/advertiser/create-ad">Create a new ad</a></p>`,
          );
        }
        await supabase.from('ad_reminder_log').insert({ advertisement_id: row.id, reminder_type: 'expired' });
        expired++;
      }
      continue;
    }

    const buckets: { type: string; days: number }[] = [
      { type: '14_day', days: 14 },
      { type: '7_day', days: 7 },
      { type: '3_day', days: 3 },
      { type: '1_day', days: 1 },
    ];
    for (const b of buckets) {
      if (d !== b.days) continue;
      const { data: existing } = await supabase
        .from('ad_reminder_log')
        .select('id')
        .eq('advertisement_id', row.id)
        .eq('reminder_type', b.type)
        .maybeSingle();
      if (existing) continue;

      const { data: prof } = await supabase
        .from('advertiser_profiles')
        .select('email, contact_name, company_name')
        .eq('id', row.advertiser_id)
        .maybeSingle();
      const p = prof as { email?: string; contact_name?: string; company_name?: string } | null;
      const email = String(p?.email || '');
      if (!email) continue;

      await sendResend(
        email,
        `Your Ground View News ad expires in ${b.days} days`,
        `<p>Hello ${p?.contact_name || p?.company_name || 'there'},</p>
<p>Your ad <strong>${row.title}</strong> expires on ${exp.toISOString().slice(0, 10)} (UTC).</p>
<p><a href="${SITE}/advertiser/create-ad">Renew or resubmit</a></p>`,
      );
      await supabase.from('ad_reminder_log').insert({ advertisement_id: row.id, reminder_type: b.type });
      reminders++;
    }
  }

  const { data: subAds } = await supabase
    .from('advertisements')
    .select('id, title, tier, price_gbp, stripe_subscription_id, advertiser_id')
    .eq('status', 'active')
    .in('tier', ['monthly', 'annual'])
    .not('stripe_subscription_id', 'is', null);

  let subReminders = 0;
  for (const ad of subAds || []) {
    const row = ad as {
      id: string;
      title: string;
      tier: string;
      price_gbp: number | null;
      stripe_subscription_id: string;
      advertiser_id: string;
    };
    const sub = await stripeGetSubscription(row.stripe_subscription_id);
    if (!sub?.current_period_end) continue;
    const periodEnd = new Date(sub.current_period_end * 1000);
    const d = daysBetween(now, periodEnd);
    if (d !== 7) continue;

    const type = 'sub_renewal_7d';
    const since = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentSub } = await supabase
      .from('ad_reminder_log')
      .select('id')
      .eq('advertisement_id', row.id)
      .eq('reminder_type', type)
      .gte('sent_at', since)
      .maybeSingle();
    if (recentSub) continue;

    const { data: prof } = await supabase
      .from('advertiser_profiles')
      .select('email, contact_name, company_name, stripe_customer_id')
      .eq('id', row.advertiser_id)
      .maybeSingle();
    const p = prof as {
      email?: string;
      contact_name?: string;
      company_name?: string;
      stripe_customer_id?: string | null;
    } | null;
    const email = String(p?.email || '');
    if (!email) continue;

    const amount = row.price_gbp != null ? `£${Number(row.price_gbp).toFixed(2)}` : 'your plan rate';
    const cancelLink = `${SITE}/advertiser/dashboard`;
    const upgradeLink = `${SITE}/advertiser/create-ad`;

    await sendResend(
      email,
      'Your Ground View News ad subscription renews in 7 days',
      `<p>Hello ${p?.contact_name || p?.company_name || 'there'},</p>
<p>Your plan for <strong>${row.title}</strong> renews on ${periodEnd.toISOString().slice(0, 10)} (UTC).</p>
<p><strong>Next charge:</strong> ${amount}</p>
<p><a href="${cancelLink}">Manage cancellation</a> · <a href="${upgradeLink}">Upgrade options</a></p>`,
    );
    await supabase.from('ad_reminder_log').insert({ advertisement_id: row.id, reminder_type: type });
    subReminders++;
  }

  return new Response(
    JSON.stringify({ ok: true, date: now.toISOString(), one_off_reminders: reminders, one_off_expired: expired, subscription_reminders: subReminders }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
