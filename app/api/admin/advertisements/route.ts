import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { isAdminServerSession } from '@/lib/admin-server';

export const runtime = 'nodejs';

function stripePaymentUrl(paymentIntentId: string | null | undefined): string | null {
  if (!paymentIntentId) return null;
  const test = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test');
  const base = test ? 'https://dashboard.stripe.com/test' : 'https://dashboard.stripe.com';
  return `${base}/payments/${paymentIntentId}`;
}

export async function GET(req: NextRequest) {
  if (!isAdminServerSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status');
  const formatFilter = searchParams.get('format');
  const tierFilter = searchParams.get('tier');

  let q = supabase
    .from('advertisements')
    .select(
      'id, title, format, tier, status, ai_review_status, ai_review_reason, created_at, expires_at, stripe_payment_intent_id, destination_url, body_text, image_url, advertiser_id, advertiser_profiles(company_name, contact_name, email)'
    )
    .order('created_at', { ascending: false });

  if (statusFilter) q = q.eq('status', statusFilter);
  if (formatFilter) q = q.eq('format', formatFilter);
  if (tierFilter) q = q.eq('tier', tierFilter);

  const { data: rows, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const now = new Date();
  const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { count: activeCount } = await supabase
    .from('advertisements')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const { data: monthAds } = await supabase
    .from('advertisements')
    .select('price_gbp, paid_at')
    .gte('paid_at', monthStart.toISOString());

  const revenueMonth = (monthAds || []).reduce((s, r: { price_gbp?: number }) => s + (Number(r.price_gbp) || 0), 0);

  const { count: pendingReview } = await supabase
    .from('advertisements')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_review');

  const { data: expiring } = await supabase
    .from('advertisements')
    .select('id')
    .eq('status', 'active')
    .lte('expires_at', week.toISOString())
    .gte('expires_at', now.toISOString());

  const list = (rows || []).map((r: Record<string, unknown>) => {
    const ap = r.advertiser_profiles as { company_name?: string; contact_name?: string; email?: string } | null;
    const name = ap?.company_name || ap?.contact_name || ap?.email || '—';
    return {
      ...r,
      advertiser_display: name,
      stripe_url: stripePaymentUrl(r.stripe_payment_intent_id as string | undefined),
    };
  });

  return NextResponse.json({
    rows: list,
    stats: {
      active_ads: activeCount || 0,
      revenue_month_gbp: revenueMonth,
      pending_review: pendingReview || 0,
      expiring_7d: expiring?.length || 0,
    },
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminServerSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = String((body as { action?: string }).action || '');
  const adId = String((body as { ad_id?: string }).ad_id || '').trim();
  const reason = typeof (body as { reason?: string }).reason === 'string' ? (body as { reason: string }).reason.trim() : '';

  if (!adId) return NextResponse.json({ error: 'Missing ad_id' }, { status: 400 });

  if (action === 'approve_override') {
    if (!reason) return NextResponse.json({ error: 'Reason required for override' }, { status: 400 });
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('advertisements')
      .update({
        status: 'active',
        ai_review_status: 'passed',
        ai_review_reason: null,
        admin_override_reason: reason,
        admin_override_at: now,
        starts_at: now,
        updated_at: now,
      })
      .eq('id', adId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'expire') {
    const { error } = await supabase
      .from('advertisements')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', adId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'cancel') {
    const { error } = await supabase
      .from('advertisements')
      .update({
        status: 'cancelled',
        cancellation_requested: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
