import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const adId = typeof body.ad_id === 'string' ? body.ad_id.trim() : '';
  const event = body.event === 'click' ? 'click' : body.event === 'view' ? 'view' : null;

  if (!adId || !event) {
    return NextResponse.json({ error: 'Missing ad_id or event' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const column = event === 'click' ? 'click_count' : 'view_count';
  const { data: row } = await supabase
    .from('advertisements')
    .select('id, view_count, click_count, impressions')
    .eq('id', adId)
    .eq('status', 'active')
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ ok: true });
  }

  const r = row as { view_count?: number; click_count?: number; impressions?: number };
  const current = event === 'click' ? Number(r.click_count || 0) : Number(r.view_count || 0);
  const updates: Record<string, number> = { [column]: current + 1 };
  if (event === 'view') {
    updates.impressions = Number(r.impressions || 0) + 1;
  }

  await supabase.from('advertisements').update(updates).eq('id', adId);

  return NextResponse.json({ ok: true });
}
