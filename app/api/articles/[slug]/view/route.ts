import { NextRequest, NextResponse } from 'next/server';
import { classifyReferrer } from '@/lib/referrer-source';
import { getServiceSupabase } from '@/lib/supabase-service';
import {
  fetchArticleMetrics,
  hasSessionView,
  incrementArticleViews,
} from '@/lib/article-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function siteHost(): string {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://groundviewnews.com';
    return new URL(base).hostname;
  } catch {
    return 'groundviewnews.com';
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { slug: string } }
) {
  const slug = decodeURIComponent(context.params.slug || '').trim();
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    session_id?: string;
    referrer?: string;
  };

  const { data: article, error: artErr } = await supabase
    .from('articles')
    .select('id, author_id, views')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (artErr || !article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  const art = article as { id: string; author_id: string | null; views?: number };
  const sessionId =
    typeof body.session_id === 'string' && body.session_id.trim()
      ? body.session_id.trim().slice(0, 128)
      : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const alreadyViewed = await hasSessionView(supabase, art.id, sessionId);
  if (alreadyViewed) {
    const metrics = await fetchArticleMetrics(supabase, slug);
    return NextResponse.json({
      ok: true,
      views: metrics?.views ?? (Number(art.views) || 0),
      recorded: false,
    });
  }

  let views: number;
  try {
    views = await incrementArticleViews(supabase, slug);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not increment views';
    console.error('[articles/view] increment', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const referrer = typeof body.referrer === 'string' ? body.referrer : '';
  const referrer_source = classifyReferrer(referrer, siteHost());

  const { error: insErr } = await supabase.from('article_views').insert({
    article_id: art.id,
    journalist_id: art.author_id,
    session_id: sessionId,
    referrer: referrer || null,
    referrer_source,
    engagement_score: 1,
  });

  if (insErr) {
    console.error('[articles/view] article_views insert', insErr.message);
    if (insErr.code === '23505') {
      const metrics = await fetchArticleMetrics(supabase, slug);
      return NextResponse.json({
        ok: true,
        views: metrics?.views ?? views,
        recorded: false,
      });
    }
  }

  return NextResponse.json({ ok: true, views, recorded: true });
}
