import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ad_expired } from '@/lib/emails/advertiser-emails';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = new Date();

  const { data: activeAds } = await supabase
    .from('advertisements')
    .select('id, title, advertiser_id, expires_at, ends_at')
    .eq('status', 'active');

  const expiredRows = (activeAds || []).filter((r: Record<string, unknown>) => {
    const ex = r.expires_at ? new Date(String(r.expires_at)) : null;
    const en = r.ends_at ? new Date(String(r.ends_at)) : null;
    const eff = ex && !Number.isNaN(ex.getTime()) ? ex : en;
    return eff && !Number.isNaN(eff.getTime()) && eff < now;
  });

  let count = 0;

  for (const adRecord of expiredRows) {
    const id = String(adRecord.id);
    const title = String(adRecord.title || 'Your ad');
    const advertiserId = String(adRecord.advertiser_id);

    const { data: prof } = await supabase
      .from('advertiser_profiles')
      .select('email, contact_name, company_name')
      .eq('id', advertiserId)
      .maybeSingle();

    await supabase
      .from('advertisements')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', id);

    const p = prof as { email?: string; contact_name?: string; company_name?: string } | null;
    const email = String(p?.email || '');
    const name = String(p?.contact_name || p?.company_name || 'Advertiser');
    if (email) {
      await ad_expired(name, email, title);
    }
    count++;
  }

  return NextResponse.json({ ok: true, expired: count });
}
