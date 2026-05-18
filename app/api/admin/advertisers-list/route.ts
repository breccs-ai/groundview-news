import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { isAdminServerSession } from '@/lib/admin-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!isAdminServerSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const q = new URL(req.url).searchParams.get('q')?.trim().toLowerCase();

  const { data: profiles, error: pErr } = await supabase
    .from('advertiser_profiles')
    .select('id, company_name, email, contact_name, created_at')
    .order('created_at', { ascending: false });

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 400 });
  }

  const { data: ads, error: aErr } = await supabase
    .from('advertisements')
    .select(
      'id, advertiser_id, title, tier, billing_cycle, status, expires_at, expiry_date, view_count, click_count, price_gbp, price_paid, paid_at'
    );

  if (aErr) {
    return NextResponse.json({ error: aErr.message }, { status: 400 });
  }

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const adsByAdvertiser = new Map<string, typeof ads>();
  for (const ad of ads || []) {
    const aid = String((ad as { advertiser_id: string }).advertiser_id);
    const list = adsByAdvertiser.get(aid) || [];
    list.push(ad);
    adsByAdvertiser.set(aid, list);
  }

  let advertisers = (profiles || []).map((p) => {
    const prof = p as {
      id: string;
      company_name: string;
      email: string;
      contact_name: string;
      created_at: string;
    };
    const adList = (adsByAdvertiser.get(prof.id) || []) as Array<{
      id: string;
      title: string;
      tier: string;
      billing_cycle: string | null;
      status: string;
      expires_at: string | null;
      expiry_date: string | null;
      view_count: number;
      click_count: number;
      price_gbp: number | null;
      price_paid: number | null;
    }>;

    const activeAds = adList.filter((a) => a.status === 'active');
    const primary = activeAds[0] || adList[0];
    const expiringSoon = adList.some((a) => {
      if (a.status !== 'active') return false;
      const ex = a.expiry_date || a.expires_at;
      if (!ex) return false;
      const t = new Date(ex).getTime();
      return t >= now && t <= now + weekMs;
    });

    return {
      id: prof.id,
      company_name: prof.company_name,
      contact_email: prof.email,
      contact_name: prof.contact_name,
      join_date: prof.created_at,
      current_tier: primary?.tier || '—',
      billing_cycle: primary?.billing_cycle || '—',
      ad_status: primary?.status || 'none',
      expiry_date: primary?.expiry_date || primary?.expires_at || null,
      expiring_within_7_days: expiringSoon,
      active_ad_count: activeAds.length,
      total_views: adList.reduce((s, a) => s + (Number(a.view_count) || 0), 0),
      total_clicks: adList.reduce((s, a) => s + (Number(a.click_count) || 0), 0),
      ads: adList.map((a) => ({
        id: a.id,
        title: a.title,
        tier: a.tier,
        billing_cycle: a.billing_cycle,
        status: a.status,
        expiry_date: a.expiry_date || a.expires_at,
        view_count: Number(a.view_count) || 0,
        click_count: Number(a.click_count) || 0,
        expiring_within_7_days:
          a.status === 'active' &&
          (() => {
            const ex = a.expiry_date || a.expires_at;
            if (!ex) return false;
            const t = new Date(ex).getTime();
            return t >= now && t <= now + weekMs;
          })(),
      })),
    };
  });

  if (q) {
    advertisers = advertisers.filter(
      (a) =>
        a.company_name.toLowerCase().includes(q) ||
        a.contact_email.toLowerCase().includes(q)
    );
  }

  const { data: paidAds } = await supabase
    .from('advertisements')
    .select('price_gbp, price_paid')
    .in('status', ['active', 'expired', 'cancelled']);

  const totalRevenue = (paidAds || []).reduce((s, a) => {
    const row = a as { price_gbp?: number; price_paid?: number };
    const v = Number(row.price_paid ?? row.price_gbp);
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);

  return NextResponse.json({
    total_revenue_gbp: totalRevenue,
    advertisers,
  });
}
