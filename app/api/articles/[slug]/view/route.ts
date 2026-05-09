import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Run in Supabase SQL Editor (adds `views` + RPC for atomic increments):
 *
 * ```sql
 * ALTER TABLE articles ADD COLUMN IF NOT EXISTS views integer DEFAULT 0;
 * ```
 *
 * ```sql
 * CREATE OR REPLACE FUNCTION increment_article_views(article_slug text)
 * RETURNS void AS $$
 * BEGIN
 *   UPDATE articles SET views = COALESCE(views, 0) + 1 WHERE slug = article_slug;
 * END;
 * $$ LANGUAGE plpgsql;
 * ```
 */
function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(
  _req: NextRequest,
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

  const { error } = await supabase.rpc('increment_article_views', {
    article_slug: slug,
  });

  if (error) {
    console.error('[articles/view]', error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
