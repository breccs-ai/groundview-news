import type { SupabaseClient } from '@supabase/supabase-js';
import { parseArticleShares, type ArticleSharesCounts, type SharePlatform } from '@/lib/article-shares';

const DEFAULT_SHARES: ArticleSharesCounts = {
  twitter: 0,
  facebook: 0,
  linkedin: 0,
  whatsapp: 0,
  total: 0,
};

export async function fetchArticleMetrics(
  supabase: SupabaseClient,
  slug: string
): Promise<{ views: number; shares: ArticleSharesCounts } | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('views, shares')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error || !data) return null;
  const row = data as { views?: number; shares?: unknown };
  return {
    views: Math.max(0, Number(row.views) || 0),
    shares: parseArticleShares(row.shares),
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
