import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    article_id?: string;
    session_id?: string;
    time_on_page_seconds?: number;
    scroll_depth_percent?: number;
    referrer?: string;
  };

  if (!body.article_id) {
    return NextResponse.json({ error: 'Missing article_id' }, { status: 400 });
  }

  const time = clampNum(body.time_on_page_seconds, 0, 60 * 60);
  const scroll = clampNum(body.scroll_depth_percent, 0, 100);
  const engagementRaw = (time / 60) * (scroll / 100);
  const engagementScore = clampNum(engagementRaw, 0, 10);

  const supabase = getServiceSupabase();
  const { error } = await supabase.from('article_views').insert({
    article_id: body.article_id,
    session_id: body.session_id || null,
    time_on_page_seconds: time,
    scroll_depth_percent: scroll,
    referrer: body.referrer || null,
    engagement_score: engagementScore,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, engagement_score: engagementScore });
}

function clampNum(value: unknown, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

