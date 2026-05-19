export type SharePlatform = 'twitter' | 'facebook' | 'linkedin' | 'whatsapp';

export type ArticleSharesCounts = {
  twitter: number;
  facebook: number;
  linkedin: number;
  whatsapp: number;
  total: number;
};

const PLATFORMS: SharePlatform[] = ['twitter', 'facebook', 'linkedin', 'whatsapp'];

export function parseArticleShares(raw: unknown): ArticleSharesCounts {
  const d =
    raw && typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const num = (k: string) => {
    const v = d[k];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.floor(v));
    const p = parseInt(String(v ?? '0'), 10);
    return Number.isFinite(p) ? Math.max(0, p) : 0;
  };
  const counts = {
    twitter: num('twitter'),
    facebook: num('facebook'),
    linkedin: num('linkedin'),
    whatsapp: num('whatsapp'),
    total: num('total'),
  };
  return withComputedShareTotal(counts);
}

/** Total is always the sum of per-platform counts (never a separate local counter). */
export function withComputedShareTotal(counts: ArticleSharesCounts): ArticleSharesCounts {
  const platformSum = PLATFORMS.reduce((sum, p) => sum + counts[p], 0);
  return { ...counts, total: platformSum };
}

export function incrementShareCount(
  counts: ArticleSharesCounts,
  platform: SharePlatform
): ArticleSharesCounts {
  return withComputedShareTotal({
    ...counts,
    [platform]: counts[platform] + 1,
  });
}
