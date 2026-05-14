/** Canonical public URL for an article (path uses /articles/[slug]). */
export function getPublicSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || 'https://groundviewnews.com';
  return raw.replace(/\/$/, '');
}

export function articlePublicPath(slug: string): string {
  return `/articles/${slug}`;
}

export function articleCanonicalUrl(slug: string): string {
  return `${getPublicSiteOrigin()}${articlePublicPath(slug)}`;
}
