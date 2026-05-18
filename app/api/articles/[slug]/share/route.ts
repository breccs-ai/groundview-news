import { NextRequest, NextResponse } from 'next/server';
import type { SharePlatform } from '@/lib/article-shares';
import { getServiceSupabase } from '@/lib/supabase-service';
import { fetchArticleMetrics, incrementArticleShare } from '@/lib/article-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORMS: SharePlatform[] = ['twitter', 'facebook', 'linkedin', 'whatsapp'];

export async function POST(
  req: NextRequest,
  context: { params: { slug: string } }
) {
  const slug = decodeURIComponent(context.params.slug || '').trim();
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { platform?: string; session_id?: string };
  const platform = body.platform as SharePlatform | undefined;
  if (!platform || !PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const { data: article } = await supabase
    .from('articles')
    .select('id')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  const articleId = (article as { id: string } | null)?.id;
  if (!articleId) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  let shares;
  try {
    shares = await incrementArticleShare(supabase, slug, platform);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not record share';
    console.error('[articles/share]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const sessionId =
    typeof body.session_id === 'string' && body.session_id.trim()
      ? body.session_id.trim().slice(0, 128)
      : null;

  const { error: logErr } = await supabase.from('article_shares').insert({
    article_id: articleId,
    share_channel: platform,
    session_id: sessionId,
  });
  if (logErr) {
    console.error('[articles/share] article_shares insert', logErr.message);
  }

  return NextResponse.json({ ok: true, shares });
}
