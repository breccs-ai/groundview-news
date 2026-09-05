import { articleCanonicalUrl, getPublicSiteOrigin } from '@/lib/article-public-url';

type ArticleForSchema = {
  title: string;
  slug: string;
  excerpt?: string | null;
  subtitle?: string | null;
  author_name?: string | null;
  category?: string | null;
  published_at?: string | null;
  featured_image_url?: string | null;
};

/**
 * NewsArticle JSON-LD for an article page. `publisher.logo` is intentionally
 * omitted — there's no logo image asset in this project yet (no public/
 * directory at all). Add one and set it here once it exists; Google treats
 * a missing logo as a missed rich-result opportunity, not an error.
 */
export function newsArticleJsonLd(article: ArticleForSchema, imageUrls: string[]): Record<string, unknown> {
  const url = articleCanonicalUrl(article.slug);
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt || article.subtitle || undefined,
    image: imageUrls.length ? imageUrls : undefined,
    datePublished: article.published_at || undefined,
    dateModified: article.published_at || undefined,
    author: article.author_name
      ? { '@type': 'Person', name: article.author_name }
      : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'Ground View News',
      url: getPublicSiteOrigin(),
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    articleSection: article.category || undefined,
    url,
  };
}

/** Serializes JSON-LD safely for a <script> tag — escapes `<` so article
 * content can never prematurely close the script element. */
export function jsonLdScript(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
