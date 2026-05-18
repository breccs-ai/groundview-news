import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { SharePlatform } from '@/lib/article-shares';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const PLATFORMS: SharePlatform[] = ['twitter', 'facebook', 'linkedin', 'whatsapp'];

export async function POST(
  req: NextRequest,
  context: { params: { slug: string } },
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

  const { data: article } = await supabase.from('articles').select('id').eq('slug', slug).maybeSingle();
  const articleId = (article as { id: string } | null)?.id;

  const { error } = await supabase.rpc('increment_article_shares', {
    article_slug: slug,
    platform_name: platform,
  });

  if (error) {
    console.error('[articles/share]', error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (articleId) {
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
  }

  return NextResponse.json({ ok: true });
}
