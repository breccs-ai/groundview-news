import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { SharePlatform } from '@/lib/article-shares';

/**
 * Run in Supabase SQL Editor (adds `shares` jsonb + RPC):
 *
 * ```sql
 * ALTER TABLE articles ADD COLUMN IF NOT EXISTS shares jsonb DEFAULT '{"twitter": 0, "facebook": 0, "linkedin": 0, "whatsapp": 0, "total": 0}'::jsonb;
 * ```
 *
 * ```sql
 * CREATE OR REPLACE FUNCTION increment_article_shares(article_slug text, platform_name text)
 * RETURNS void AS $$
 * BEGIN
 *   UPDATE articles
 *   SET shares = jsonb_set(
 *     jsonb_set(
 *       COALESCE(shares, '{}'::jsonb),
 *       ARRAY[platform_name],
 *       to_jsonb(COALESCE((shares->>platform_name)::integer, 0) + 1),
 *       true
 *     ),
 *     ARRAY['total'],
 *     to_jsonb(COALESCE((shares->>'total')::integer, 0) + 1),
 *     true
 *   )
 *   WHERE slug = article_slug;
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

const PLATFORMS: SharePlatform[] = ['twitter', 'facebook', 'linkedin', 'whatsapp'];

export async function POST(
  req: NextRequest,
  context: { params: { slug: string } },
) {
  const slug = decodeURIComponent(context.params.slug || '').trim();
  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { platform?: string };
  const platform = body.platform as SharePlatform | undefined;
  if (!platform || !PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const { error } = await supabase.rpc('increment_article_shares', {
    article_slug: slug,
    platform_name: platform,
  });

  if (error) {
    console.error('[articles/share]', error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
