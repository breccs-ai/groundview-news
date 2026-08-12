import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { getApprovedWriter } from '@/lib/writer-server-auth';

const PAYMENT_METHODS = new Set([
  'bank_transfer',
  'wise',
  'paypal',
  'mobile_money',
  'remittance_service',
  'other',
]);

async function settingNumber(key: string, fallback: number): Promise<number> {
  const service = getServiceSupabase();
  if (!service) return fallback;
  const { data } = await service.from('site_settings').select('value').eq('key', key).maybeSingle();
  const n = Number((data as { value?: unknown } | null)?.value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest) {
  const writer = await getApprovedWriter(req);
  if (!writer) return NextResponse.json({ error: 'Approved writer access required.' }, { status: 403 });
  const service = getServiceSupabase();
  if (!service) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

  const [profileResult, sharesResult, requestsResult, sharePercent, minimum] = await Promise.all([
    service.from('writer_payout_profiles').select('*').eq('journalist_id', writer.id).maybeSingle(),
    service
      .from('journalist_revenue_shares')
      .select('id, month_start, month_end, total_ad_revenue, journalist_pool, weighted_views, view_share, amount_earned, status, paid_at')
      .eq('journalist_id', writer.id)
      .order('month_start', { ascending: false }),
    service
      .from('writer_payment_requests')
      .select('id, amount, currency, status, writer_note, admin_note, transaction_reference, requested_at, processing_at, paid_at, resolved_at')
      .eq('journalist_id', writer.id)
      .order('requested_at', { ascending: false }),
    settingNumber('journalist_revenue_share_percent', 30),
    settingNumber('writer_payment_minimum_gbp', 25),
  ]);

  if (sharesResult.error || requestsResult.error) {
    return NextResponse.json(
      { error: sharesResult.error?.message || requestsResult.error?.message || 'Could not load earnings.' },
      { status: 400 }
    );
  }

  const shares = sharesResult.data || [];
  const requests = requestsResult.data || [];
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const [viewsResult, adsResult, platformCosts] = await Promise.all([
    service
      .from('article_views')
      .select('article_id, journalist_id, engagement_score')
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd),
    service
      .from('advertisements')
      .select('price_gbp, price_paid')
      .in('status', ['active', 'expired'])
      .gte('paid_at', monthStart)
      .lt('paid_at', monthEnd),
    settingNumber('platform_cost_monthly', 0),
  ]);
  const weight = (score: unknown) => {
    const n = Number(score);
    const normalized = Number.isFinite(n) ? n : 1;
    return normalized < 0.5 ? 0.2 : normalized;
  };
  const currentViews = viewsResult.data || [];
  const totalWeight = currentViews.reduce((sum, row) => sum + weight(row.engagement_score), 0);
  const writerViews = currentViews.filter((row) => row.journalist_id === writer.id);
  const writerWeight = writerViews.reduce((sum, row) => sum + weight(row.engagement_score), 0);
  const adRevenue = (adsResult.data || []).reduce((sum, row) => {
    const amount = Number(row.price_paid ?? row.price_gbp);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const currentPool = Math.max(0, adRevenue - platformCosts) * (sharePercent / 100);
  const accruingEstimate = totalWeight > 0 ? currentPool * (writerWeight / totalWeight) : 0;

  const articleWeights = new Map<string, number>();
  for (const row of writerViews) {
    const articleId = String(row.article_id || '');
    if (articleId) articleWeights.set(articleId, (articleWeights.get(articleId) || 0) + weight(row.engagement_score));
  }
  const articleIds = Array.from(articleWeights.keys());
  const { data: articleRows } = articleIds.length
    ? await service.from('articles').select('id, title, slug').in('id', articleIds)
    : { data: [] as { id: string; title: string; slug: string }[] };
  const articlePerformance = (articleRows || []).map((article) => {
    const articleWeight = articleWeights.get(String(article.id)) || 0;
    const writerShare = writerWeight > 0 ? articleWeight / writerWeight : 0;
    return {
      id: article.id,
      title: article.title,
      slug: article.slug,
      weighted_views: articleWeight,
      share_of_writer_engagement: writerShare,
      estimated_earnings: accruingEstimate * writerShare,
    };
  }).sort((a, b) => b.estimated_earnings - a.estimated_earnings);
  const totalEarned = shares.reduce((sum, row) => sum + (Number(row.amount_earned) || 0), 0);
  const committed = requests
    .filter((row) => ['requested', 'processing', 'paid'].includes(String(row.status)))
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const paid = requests
    .filter((row) => row.status === 'paid')
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  return NextResponse.json({
    payout_profile: profileResult.data || null,
    shares,
    requests,
    summary: {
      total_earned: totalEarned,
      available: Math.max(0, totalEarned - committed),
      pending_payment: committed - paid,
      paid,
      share_percent: sharePercent,
      minimum_request: minimum,
      accruing_estimate: accruingEstimate,
      current_pool: currentPool,
    },
    article_performance: articlePerformance,
  });
}

export async function PUT(req: NextRequest) {
  const writer = await getApprovedWriter(req);
  if (!writer) return NextResponse.json({ error: 'Approved writer access required.' }, { status: 403 });
  const service = getServiceSupabase();
  if (!service) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const paymentMethod = String(body.payment_method || '').trim();
  const recipientName = String(body.recipient_name || '').trim();
  const country = String(body.country || '').trim();
  const currency = String(body.currency || '').trim().toUpperCase();
  const serviceName = String(body.service_name || '').trim();
  const paymentDetails = String(body.payment_details || '').trim();

  if (!PAYMENT_METHODS.has(paymentMethod) || !recipientName || !country || !/^[A-Z]{3}$/.test(currency) || !paymentDetails) {
    return NextResponse.json({ error: 'Please complete all payout fields.' }, { status: 400 });
  }
  if (recipientName.length > 120 || country.length > 80 || serviceName.length > 120 || paymentDetails.length > 1200) {
    return NextResponse.json({ error: 'One or more payout fields are too long.' }, { status: 400 });
  }

  const { error } = await service.from('writer_payout_profiles').upsert({
    journalist_id: writer.id,
    payment_method: paymentMethod,
    recipient_name: recipientName,
    country,
    currency,
    service_name: serviceName || null,
    payment_details: paymentDetails,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
