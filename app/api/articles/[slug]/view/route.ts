import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyReferrer } from '@/lib/referrer-source';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

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
  context: { params: { slug: string } },
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
    .select('id, author_id')
    .eq('slug', slug)
    .maybeSingle();

  if (artErr || !article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  const art = article as { id: string; author_id: string | null };
  const referrer = typeof body.referrer === 'string' ? body.referrer : '';
  const referrer_source = classifyReferrer(referrer, siteHost());
  const sessionId =
    typeof body.session_id === 'string' && body.session_id.trim()
      ? body.session_id.trim().slice(0, 128)
      : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const { error: rpcErr } = await supabase.rpc('increment_article_views', {
    article_slug: slug,
  });

  if (rpcErr) {
    console.error('[articles/view]', rpcErr.message);
    return NextResponse.json({ error: rpcErr.message }, { status: 400 });
  }

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
  }

  return NextResponse.json({ ok: true });
}
