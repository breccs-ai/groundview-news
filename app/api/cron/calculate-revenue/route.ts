import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function monthRangeUTC(date = new Date()) {
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1, 0, 0, 0));
  const monthLabel = start.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { startISO: start.toISOString(), endISO: end.toISOString(), monthLabel };
}

async function getSettingNumber(supabase: ReturnType<typeof getSupabase>, key: string, fallback: number) {
  const { data } = await supabase.from('site_settings').select('value').eq('key', key).maybeSingle();
  const raw = (data as any)?.value;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const { startISO, endISO, monthLabel } = monthRangeUTC();

  // 1) Total advertising revenue (previous month)
  const { data: ads, error: adsErr } = await supabase
    .from('advertisements')
    .select('price_paid, status, paid_at, updated_at')
    .in('status', ['active', 'expired'])
    .gte('paid_at', startISO)
    .lt('paid_at', endISO);

  if (adsErr) return NextResponse.json({ error: adsErr.message }, { status: 400 });

  const totalAdRevenue = (ads || []).reduce((sum, a: any) => sum + (Number(a.price_paid) || 0), 0);

  // 2) Platform costs
  const platformCosts = await getSettingNumber(supabase, 'platform_cost_monthly', 0);

  // 3) Net revenue
  const netRevenue = Math.max(0, totalAdRevenue - platformCosts);

  // 4) Journalist pool
  const sharePercent = await getSettingNumber(supabase, 'journalist_revenue_share_percent', 30);
  const journalistPool = netRevenue * (sharePercent / 100);

  // 5) Weighted views total for previous month
  const { data: views, error: viewsErr } = await supabase
    .from('article_views')
    .select('article_id, journalist_id, engagement_score, created_at')
    .gte('created_at', startISO)
    .lt('created_at', endISO);

  if (viewsErr) return NextResponse.json({ error: viewsErr.message }, { status: 400 });

  const weighted = (views || []).map((v: any) => {
    const e = Number(v.engagement_score);
    const norm = Number.isFinite(e) ? e : 1;
    const w = norm < 0.5 ? 0.2 : norm;
    return { ...v, weighted_views: w };
  });

  const totalWeightedViews = weighted.reduce((sum: number, v: any) => sum + (Number(v.weighted_views) || 0), 0);

  // 6) Per journalist aggregation (only journalists with at least one published article that month)
  // Assumption: article_views has journalist_id in your existing DB schema
  const byJournalist = new Map<string, { weightedViews: number; views: number }>();
  for (const v of weighted) {
    const jid = String((v as any).journalist_id || '');
    if (!jid) continue;
    const prev = byJournalist.get(jid) || { weightedViews: 0, views: 0 };
    prev.views += 1;
    prev.weightedViews += Number((v as any).weighted_views) || 0;
    byJournalist.set(jid, prev);
  }

  const inserts: any[] = [];
  for (const [journalistId, agg] of byJournalist.entries()) {
    if (totalWeightedViews <= 0) continue;
    const viewShare = agg.weightedViews / totalWeightedViews;
    const amountEarned = journalistPool * viewShare;
    inserts.push({
      journalist_id: journalistId,
      month_start: startISO,
      month_end: endISO,
      total_ad_revenue: totalAdRevenue,
      platform_costs: platformCosts,
      net_revenue: netRevenue,
      journalist_pool: journalistPool,
      weighted_views: agg.weightedViews,
      total_weighted_views: totalWeightedViews,
      view_share: viewShare,
      amount_earned: amountEarned,
      status: 'pending',
    });
  }

  // 7) Write shares + email statements
  const { data: shares, error: insertErr } = await supabase
    .from('journalist_revenue_shares')
    .insert(inserts)
    .select('journalist_id, amount_earned, view_share, weighted_views');

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 });

  // Email each journalist (best-effort)
  for (const row of (shares || []) as any[]) {
    const journalistId = row.journalist_id;
    const { data: prof } = await supabase.from('profiles').select('email, pen_name, full_name').eq('id', journalistId).maybeSingle();
    const email = (prof as any)?.email as string | undefined;
    if (!email) continue;

    const pct = `${Math.round((Number(row.view_share) || 0) * 10000) / 100}%`;
    const amount = formatGBP(Number(row.amount_earned) || 0);

    await sendEmail(
      email,
      `Your Ground View News earnings for ${monthLabel}`,
      `<p>Here is your monthly statement for <strong>${monthLabel}</strong>.</p>
<p><strong>Weighted views:</strong> ${Number(row.weighted_views || 0).toFixed(2)}</p>
<p><strong>View share:</strong> ${pct}</p>
<p><strong>Amount earned:</strong> ${amount}</p>`
    );
  }

  return NextResponse.json({
    ok: true,
    month: monthLabel,
    totalAdRevenue,
    platformCosts,
    netRevenue,
    journalistPool,
    totalWeightedViews,
    journalists: inserts.length,
  });
}

function formatGBP(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

