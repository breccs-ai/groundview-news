import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { isAdminServerSession } from '@/lib/admin-server';
import { getCategoryMeta } from '@/lib/supabase';
import { referrerSourceToTrafficGroup, socialPlatformLabel } from '@/lib/referrer-source';
import type { SharePlatform } from '@/lib/article-shares';

export const runtime = 'nodejs';

export async function GET() {
  if (!isAdminServerSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const { data: viewRows, error: viewsErr } = await supabase
    .from('article_views')
    .select('id, article_id, session_id, referrer_source, created_at');

  if (viewsErr) {
    return NextResponse.json({ error: viewsErr.message }, { status: 400 });
  }

  const views = viewRows || [];
  const sessionIds = new Set<string>();
  let uniqueReaders = 0;
  for (const v of views) {
    const sid = (v as { session_id?: string }).session_id;
    if (sid) {
      if (!sessionIds.has(sid)) {
        sessionIds.add(sid);
        uniqueReaders++;
      }
    } else {
      uniqueReaders++;
    }
  }

  const totalViewEvents = views.length;

  const { data: articles } = await supabase
    .from('articles')
    .select('id, title, slug, category, views, shares')
    .eq('status', 'published');

  const published = articles || [];
  const totalArticleViews = published.reduce((s, a) => s + (Number((a as { views?: number }).views) || 0), 0);

  const viewsByArticle = new Map<string, number>();
  for (const v of views) {
    const aid = String((v as { article_id?: string }).article_id || '');
    if (!aid) continue;
    viewsByArticle.set(aid, (viewsByArticle.get(aid) || 0) + 1);
  }

  const topArticles = published
    .map((a) => {
      const row = a as { id: string; title: string; category: string; views?: number };
      const meta = getCategoryMeta(row.category);
      const tracked = viewsByArticle.get(row.id) || 0;
      const counter = Number(row.views) || 0;
      return {
        id: row.id,
        title: row.title,
        category: meta.label,
        category_slug: row.category,
        view_count: Math.max(counter, tracked),
      };
    })
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 10);

  const categoryTotals = new Map<string, number>();
  for (const a of published) {
    const row = a as { category: string; views?: number };
    const meta = getCategoryMeta(row.category);
    const label = meta.label;
    const n = Number(row.views) || 0;
    categoryTotals.set(label, (categoryTotals.get(label) || 0) + n);
  }
  let bestCategory = { label: '—', views: 0 };
  for (const [label, v] of Array.from(categoryTotals.entries())) {
    if (v > bestCategory.views) bestCategory = { label, views: v };
  }

  const trafficCounts: Record<string, number> = {
    direct: 0,
    search: 0,
    social: 0,
    referral: 0,
    unknown: 0,
  };
  const socialBreakdown: Record<string, number> = {
    social_twitter: 0,
    social_facebook: 0,
    social_linkedin: 0,
    social_whatsapp: 0,
  };

  for (const v of views) {
    const src = String((v as { referrer_source?: string }).referrer_source || 'unknown');
    const group = referrerSourceToTrafficGroup(src);
    trafficCounts[group] = (trafficCounts[group] || 0) + 1;
    if (src.startsWith('social_')) {
      socialBreakdown[src] = (socialBreakdown[src] || 0) + 1;
    }
  }

  const trafficSources = [
    { label: 'Direct', value: trafficCounts.direct },
    { label: 'Search engines', value: trafficCounts.search },
    { label: 'Social media', value: trafficCounts.social },
    { label: 'Referral', value: trafficCounts.referral },
    { label: 'Unknown', value: trafficCounts.unknown },
  ].filter((x) => x.value > 0);

  const socialPlatforms = Object.entries(socialBreakdown)
    .filter(([, n]) => n > 0)
    .map(([k, value]) => ({ label: socialPlatformLabel(k), value }));

  const { data: shareEvents } = await supabase.from('article_shares').select('share_channel');

  const shareByChannel: Record<SharePlatform, number> = {
    twitter: 0,
    facebook: 0,
    linkedin: 0,
    whatsapp: 0,
  };
  for (const e of shareEvents || []) {
    const ch = String((e as { share_channel?: string }).share_channel || '') as SharePlatform;
    if (ch in shareByChannel) shareByChannel[ch]++;
  }

  const eventTotal = Object.values(shareByChannel).reduce((a, b) => a + b, 0);
  if (eventTotal === 0) {
    for (const a of published) {
      const raw = (a as { shares?: unknown }).shares;
      if (!raw || typeof raw !== 'object') continue;
      const d = raw as Record<string, unknown>;
      for (const p of ['twitter', 'facebook', 'linkedin', 'whatsapp'] as SharePlatform[]) {
        const n = Number(d[p]);
        if (Number.isFinite(n)) shareByChannel[p] += n;
      }
    }
  }

  const shareChannels = [
    { label: 'Twitter / X', value: shareByChannel.twitter },
    { label: 'Facebook', value: shareByChannel.facebook },
    { label: 'LinkedIn', value: shareByChannel.linkedin },
    { label: 'WhatsApp', value: shareByChannel.whatsapp },
  ].filter((x) => x.value > 0);

  const totalShares = shareChannels.reduce((s, x) => s + x.value, 0);

  return NextResponse.json({
    readership: {
      unique_readers: uniqueReaders,
      total_view_events: totalViewEvents,
      total_article_views: totalArticleViews,
      top_articles: topArticles,
      best_category: bestCategory,
    },
    traffic: {
      sources: trafficSources,
      social_platforms: socialPlatforms,
    },
    sharing: {
      total_shares: totalShares,
      by_channel: shareChannels,
    },
  });
}
