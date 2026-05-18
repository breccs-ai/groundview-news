import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { isAdminServerSession } from '@/lib/admin-server';

export const runtime = 'nodejs';

type PeriodRange = { startISO: string; endISO: string };

function monthRangeUTC(year: number, monthIndex: number): PeriodRange {
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function currentMonthRangeUTC(date = new Date()): PeriodRange {
  return monthRangeUTC(date.getUTCFullYear(), date.getUTCMonth());
}

function previousMonthRangeUTC(date = new Date()): PeriodRange {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  if (m === 0) return monthRangeUTC(y - 1, 11);
  return monthRangeUTC(y, m - 1);
}

async function getSettingNumber(
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
  key: string,
  fallback: number
) {
  const { data } = await supabase.from('site_settings').select('value').eq('key', key).maybeSingle();
  const raw = (data as { value?: unknown } | null)?.value;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

type ViewRow = { journalist_id?: string; engagement_score?: number };

function buildWeightedMap(views: ViewRow[]): Map<string, number> {
  const weightedByJournalist = new Map<string, number>();
  for (const v of views) {
    const jid = String(v.journalist_id || '');
    if (!jid) continue;
    const e = Number(v.engagement_score);
    const norm = Number.isFinite(e) ? e : 1;
    const w = norm < 0.5 ? 0.2 : norm;
    weightedByJournalist.set(jid, (weightedByJournalist.get(jid) || 0) + w);
  }
  return weightedByJournalist;
}

async function computePeriodShare(
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
  range: PeriodRange,
  sharePercent: number,
  platformCosts: number
) {
  const { data: monthViews } = await supabase
    .from('article_views')
    .select('journalist_id, engagement_score')
    .gte('created_at', range.startISO)
    .lt('created_at', range.endISO);

  const weightedByJournalist = buildWeightedMap((monthViews || []) as ViewRow[]);
  const totalWeighted = Array.from(weightedByJournalist.values()).reduce((a, b) => a + b, 0);

  const { data: monthAds } = await supabase
    .from('advertisements')
    .select('price_gbp, price_paid, paid_at')
    .in('status', ['active', 'expired'])
    .gte('paid_at', range.startISO)
    .lt('paid_at', range.endISO);

  const totalAdRevenue = (monthAds || []).reduce((s, a) => {
    const row = a as { price_gbp?: number; price_paid?: number };
    const v = Number(row.price_paid ?? row.price_gbp);
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);

  const netRevenue = Math.max(0, totalAdRevenue - platformCosts);
  const journalistPool = netRevenue * (sharePercent / 100);

  const owedByJournalist = new Map<string, number>();
  for (const [jid, wv] of Array.from(weightedByJournalist.entries())) {
    const viewShare = totalWeighted > 0 ? wv / totalWeighted : 0;
    owedByJournalist.set(jid, journalistPool * viewShare);
  }

  const totalOwed = Array.from(owedByJournalist.values()).reduce((a, b) => a + b, 0);

  return {
    range,
    total_ad_revenue_gbp: totalAdRevenue,
    net_revenue_gbp: netRevenue,
    journalist_pool_gbp: journalistPool,
    total_owed_gbp: totalOwed,
    owedByJournalist,
  };
}

export async function GET() {
  if (!isAdminServerSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const platformCosts = await getSettingNumber(supabase, 'platform_cost_monthly', 0);
  const sharePercent = await getSettingNumber(supabase, 'journalist_revenue_share_percent', 30);

  const thisMonthRange = currentMonthRangeUTC();
  const lastMonthRange = previousMonthRangeUTC();

  const [thisMonth, lastMonth] = await Promise.all([
    computePeriodShare(supabase, thisMonthRange, sharePercent, platformCosts),
    computePeriodShare(supabase, lastMonthRange, sharePercent, platformCosts),
  ]);

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select(
      'id, full_name, pen_name, email, subscription_tier, subscription_status, role, roles, created_at'
    );

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 400 });
  }

  const journalists = (profiles || []).filter((p) => {
    const row = p as { role?: string; roles?: string[] | null };
    return row.role === 'journalist' || (row.roles || []).includes('journalist');
  });

  const { data: articles } = await supabase
    .from('articles')
    .select('id, author_id, views')
    .not('author_id', 'is', null);

  const articleCount = new Map<string, number>();
  const viewsFromArticles = new Map<string, number>();
  for (const a of articles || []) {
    const row = a as { author_id: string; views?: number };
    const jid = row.author_id;
    articleCount.set(jid, (articleCount.get(jid) || 0) + 1);
    viewsFromArticles.set(jid, (viewsFromArticles.get(jid) || 0) + (Number(row.views) || 0));
  }

  const list = journalists.map((p) => {
    const row = p as {
      id: string;
      full_name: string;
      pen_name: string | null;
      email: string;
      subscription_tier: string | null;
      subscription_status: string;
      created_at: string;
    };

    return {
      id: row.id,
      name: row.pen_name || row.full_name,
      email: row.email,
      join_date: row.created_at,
      subscription_tier: row.subscription_tier || 'free',
      status: row.subscription_status || 'pending_approval',
      article_count: articleCount.get(row.id) || 0,
      total_views: viewsFromArticles.get(row.id) || 0,
      this_month_accruing_gbp: thisMonth.owedByJournalist.get(row.id) || 0,
      last_month_settled_gbp: lastMonth.owedByJournalist.get(row.id) || 0,
    };
  });

  return NextResponse.json({
    share_percent: sharePercent,
    platform_costs_gbp: platformCosts,
    this_month: {
      start: thisMonthRange.startISO,
      end: thisMonthRange.endISO,
      total_ad_revenue_gbp: thisMonth.total_ad_revenue_gbp,
      net_revenue_gbp: thisMonth.net_revenue_gbp,
      journalist_pool_gbp: thisMonth.journalist_pool_gbp,
      total_owed_gbp: thisMonth.total_owed_gbp,
    },
    last_month: {
      start: lastMonthRange.startISO,
      end: lastMonthRange.endISO,
      total_ad_revenue_gbp: lastMonth.total_ad_revenue_gbp,
      net_revenue_gbp: lastMonth.net_revenue_gbp,
      journalist_pool_gbp: lastMonth.journalist_pool_gbp,
      total_owed_gbp: lastMonth.total_owed_gbp,
    },
    journalists: list.sort((a, b) => b.this_month_accruing_gbp - a.this_month_accruing_gbp),
  });
}
