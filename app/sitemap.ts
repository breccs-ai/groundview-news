import type { MetadataRoute } from 'next';
import { getPublishedArticles, CATEGORIES } from '@/lib/supabase';
import { articleCanonicalUrl, getPublicSiteOrigin } from '@/lib/article-public-url';

const STATIC_PAGES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '/', changeFrequency: 'hourly', priority: 1 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/advertise', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/write-for-us', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/subscribe', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/editorial-policy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/disclaimer', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/privacy-policy', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/terms-of-use', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/legal/advertiser-terms', changeFrequency: 'yearly', priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getPublicSiteOrigin();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: `${origin}${p.path}`,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));

  const categoryEntries: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: `${origin}/category/${c.slug}`,
    changeFrequency: 'daily',
    priority: 0.6,
  }));

  let articleEntries: MetadataRoute.Sitemap = [];
  try {
    const articles = await getPublishedArticles();
    articleEntries = articles
      .filter((a) => a.slug)
      .map((a) => ({
        url: articleCanonicalUrl(a.slug),
        lastModified: a.published_at ? new Date(a.published_at) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
  } catch (e) {
    console.error('[sitemap] failed to load articles', e);
  }

  return [...staticEntries, ...categoryEntries, ...articleEntries];
}
