import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { isAdminServerSession } from '@/lib/admin-server';

export const runtime = 'nodejs';

function monthRangeUTC(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0));
  return { startISO: start.toISOString(), endISO: end.toISOString() };
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

export async function GET() {
  if (!isAdminServerSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const { startISO, endISO } = monthRangeUTC();

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
    .select('id, author_id, views, status')
    .not('author_id', 'is', null);

  const articleCount = new Map<string, number>();
  const viewsFromArticles = new Map<string, number>();
  for (const a of articles || []) {
    const row = a as { author_id: string; views?: number };
    const jid = row.author_id;
    articleCount.set(jid, (articleCount.get(jid) || 0) + 1);
    viewsFromArticles.set(jid, (viewsFromArticles.get(jid) || 0) + (Number(row.views) || 0));
  }

  const { data: monthViews } = await supabase
    .from('article_views')
    .select('journalist_id, engagement_score')
    .gte('created_at', startISO)
    .lt('created_at', endISO);

  const weightedByJournalist = new Map<string, number>();
  for (const v of monthViews || []) {
    const jid = String((v as { journalist_id?: string }).journalist_id || '');
    if (!jid) continue;
    const e = Number((v as { engagement_score?: number }).engagement_score);
    const norm = Number.isFinite(e) ? e : 1;
    const w = norm < 0.5 ? 0.2 : norm;
    weightedByJournalist.set(jid, (weightedByJournalist.get(jid) || 0) + w);
  }

  const totalWeighted = Array.from(weightedByJournalist.values()).reduce((a, b) => a + b, 0);

  const { data: monthAds } = await supabase
    .from('advertisements')
    .select('price_gbp, price_paid, paid_at')
    .in('status', ['active', 'expired'])
    .gte('paid_at', startISO)
    .lt('paid_at', endISO);

  const totalAdRevenue = (monthAds || []).reduce((s, a) => {
    const row = a as { price_gbp?: number; price_paid?: number };
    const v = Number(row.price_paid ?? row.price_gbp);
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);

  const platformCosts = await getSettingNumber(supabase, 'platform_cost_monthly', 0);
  const sharePercent = await getSettingNumber(supabase, 'journalist_revenue_share_percent', 30);
  const netRevenue = Math.max(0, totalAdRevenue - platformCosts);
  const journalistPool = netRevenue * (sharePercent / 100);

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
    const wv = weightedByJournalist.get(row.id) || 0;
    const viewShare = totalWeighted > 0 ? wv / totalWeighted : 0;
    const owed = journalistPool * viewShare;

    return {
      id: row.id,
      name: row.pen_name || row.full_name,
      email: row.email,
      join_date: row.created_at,
      subscription_tier: row.subscription_tier || 'free',
      status: row.subscription_status || 'pending_approval',
      article_count: articleCount.get(row.id) || 0,
      total_views: viewsFromArticles.get(row.id) || 0,
      month_weighted_views: wv,
      month_view_share: viewShare,
      revenue_share_owed_gbp: owed,
    };
  });

  const totalOwed = list.reduce((s, j) => s + j.revenue_share_owed_gbp, 0);

  return NextResponse.json({
    month: {
      start: startISO,
      end: endISO,
      total_ad_revenue_gbp: totalAdRevenue,
      platform_costs_gbp: platformCosts,
      net_revenue_gbp: netRevenue,
      journalist_pool_gbp: journalistPool,
      share_percent: sharePercent,
      total_owed_gbp: totalOwed,
    },
    journalists: list.sort((a, b) => b.revenue_share_owed_gbp - a.revenue_share_owed_gbp),
  });
}
