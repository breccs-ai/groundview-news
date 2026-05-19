import type { SupabaseClient } from '@supabase/supabase-js';
import { parseArticleShares, type ArticleSharesCounts, type SharePlatform } from '@/lib/article-shares';

const DEFAULT_SHARES: ArticleSharesCounts = {
  twitter: 0,
  facebook: 0,
  linkedin: 0,
  whatsapp: 0,
  total: 0,
};

async function countSharesFromEvents(
  supabase: SupabaseClient,
  articleId: string
): Promise<ArticleSharesCounts> {
  const counts: ArticleSharesCounts = { ...DEFAULT_SHARES };
  const { data, error } = await supabase
    .from('article_shares')
    .select('share_channel')
    .eq('article_id', articleId);

  if (error || !data) return counts;

  for (const row of data) {
    const ch = String((row as { share_channel?: string }).share_channel || '') as SharePlatform;
    if (ch === 'twitter' || ch === 'facebook' || ch === 'linkedin' || ch === 'whatsapp') {
      counts[ch]++;
    }
  }

  counts.total = counts.twitter + counts.facebook + counts.linkedin + counts.whatsapp;
  return counts;
}

function resolveArticleShares(
  jsonbShares: ArticleSharesCounts,
  eventShares: ArticleSharesCounts
): ArticleSharesCounts {
  const eventTotal =
    eventShares.twitter + eventShares.facebook + eventShares.linkedin + eventShares.whatsapp;
  if (eventTotal > 0) return eventShares;

  return jsonbShares;
}

export async function fetchArticleMetrics(
  supabase: SupabaseClient,
  slug: string
): Promise<{ views: number; shares: ArticleSharesCounts } | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('id, views, shares')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error || !data) return null;
  const row = data as { id?: string; views?: number; shares?: unknown };
  const jsonbShares = parseArticleShares(row.shares);
  const articleId = row.id;
  const eventShares = articleId
    ? await countSharesFromEvents(supabase, articleId)
    : { ...DEFAULT_SHARES };

  return {
    views: Math.max(0, Number(row.views) || 0),
    shares: resolveArticleShares(jsonbShares, eventShares),
  };
}

export async function incrementArticleViews(
  supabase: SupabaseClient,
  slug: string
): Promise<number> {
  const { error: rpcErr } = await supabase.rpc('increment_article_views', {
    article_slug: slug,
  });

  if (rpcErr) {
    const current = await fetchArticleMetrics(supabase, slug);
    const next = (current?.views ?? 0) + 1;
    const { error: upErr } = await supabase
      .from('articles')
      .update({ views: next })
      .eq('slug', slug)
      .eq('status', 'published');
    if (upErr) throw new Error(upErr.message);
    return next;
  }

  const refreshed = await fetchArticleMetrics(supabase, slug);
  return refreshed?.views ?? 0;
}

export async function incrementArticleShare(
  supabase: SupabaseClient,
  slug: string,
  platform: SharePlatform
): Promise<ArticleSharesCounts> {
  const { error: rpcErr } = await supabase.rpc('increment_article_shares', {
    article_slug: slug,
    platform_name: platform,
  });

  if (rpcErr) {
    const current = (await fetchArticleMetrics(supabase, slug))?.shares ?? { ...DEFAULT_SHARES };
    const next: ArticleSharesCounts = {
      ...current,
      [platform]: current[platform] + 1,
      total: current.total + 1,
    };
    const { error: upErr } = await supabase
      .from('articles')
      .update({ shares: next })
      .eq('slug', slug)
      .eq('status', 'published');
    if (upErr) throw new Error(upErr.message);
    return next;
  }

  const refreshed = await fetchArticleMetrics(supabase, slug);
  return refreshed?.shares ?? { ...DEFAULT_SHARES };
}

export async function hasSessionView(
  supabase: SupabaseClient,
  articleId: string,
  sessionId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('article_views')
    .select('id')
    .eq('article_id', articleId)
    .eq('session_id', sessionId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}
