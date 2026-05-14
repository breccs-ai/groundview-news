export type SharePlatform = 'twitter' | 'facebook' | 'linkedin' | 'whatsapp';

export type ArticleSharesCounts = {
  twitter: number;
  facebook: number;
  linkedin: number;
  whatsapp: number;
  total: number;
};

export function parseArticleShares(raw: unknown): ArticleSharesCounts {
  const d =
    raw && typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const num = (k: string) => {
    const v = d[k];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.floor(v));
    const p = parseInt(String(v ?? '0'), 10);
    return Number.isFinite(p) ? Math.max(0, p) : 0;
  };
  return {
    twitter: num('twitter'),
    facebook: num('facebook'),
    linkedin: num('linkedin'),
    whatsapp: num('whatsapp'),
    total: num('total'),
  };
}
