export const ADMIN_COOKIE = 'gvn_admin_session';
export const ADMIN_COOKIE_VALUE = 'authenticated';

export function isAdminAuthenticated(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => {
    const eq = c.indexOf('=');
    const name = c.slice(0, eq).trim();
    const value = c.slice(eq + 1).trim();
    return name === ADMIN_COOKIE && value === ADMIN_COOKIE_VALUE;
  });
}

export function clearAdminSession() {
  document.cookie = `${ADMIN_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

// Order mirrors lib/supabase.ts CATEGORIES. Keep these two in sync.
export const CATEGORY_OPTIONS = [
  { value: 'world-politics', label: 'World Politics' },
  { value: 'business-economy', label: 'Business & Economy' },
  { value: 'financial-news-banking', label: 'Financial News & Banking' },
  { value: 'sports', label: 'Sports' },
  { value: 'africa-diaspora', label: 'Africa & Diaspora' },
  { value: 'science-technology', label: 'Science & Technology' },
  { value: 'culture-society', label: 'Culture & Society' },
  { value: 'human-interest', label: 'Human Interest' },
  { value: 'environment-climate', label: 'Environment & Climate' },
  { value: 'health-medicine', label: 'Health & Medicine' },
  { value: 'law-justice', label: 'Law & Justice' },
  { value: 'education', label: 'Education' },
  { value: 'travel-migration', label: 'Travel & Migration' },
  { value: 'opinion-commentary', label: 'Opinion & Commentary' },
  { value: 'human-rights', label: 'Human Rights' },
];

/** Values must match DB `articles_label_check` / editorial dropdowns. */
export const LABEL_OPTIONS = [
  'Commentary',
  'Opinion',
  'In Depth',
  'Analysis',
  'Editorial',
  'News',
  'Interview',
  'Feature',
] as const;

export type ArticleLabel = (typeof LABEL_OPTIONS)[number];

/**
 * Allowed `articles.category` slug values for validation/normalisation.
 * Includes the 15 current writer-facing slugs plus the legacy `economy` and
 * `commentary` slugs so already-published articles continue to validate when
 * being edited. New articles default to the new slugs (see
 * `normalizeArticleCategory`).
 */
export const ARTICLE_CATEGORY_SLUGS = [
  'world-politics',
  'business-economy',
  'financial-news-banking',
  'sports',
  'africa-diaspora',
  'science-technology',
  'culture-society',
  'human-interest',
  'environment-climate',
  'health-medicine',
  'law-justice',
  'education',
  'travel-migration',
  'opinion-commentary',
  'human-rights',
  // Legacy — retained for existing rows. Not offered to new writers via CATEGORY_OPTIONS.
  'economy',
  'commentary',
] as const;

export function normalizeArticleLabel(input: string | undefined | null): ArticleLabel {
  const t = typeof input === 'string' ? input.trim() : '';
  if (!t) return 'Commentary';
  return (LABEL_OPTIONS as readonly string[]).includes(t)
    ? (t as ArticleLabel)
    : 'Commentary';
}

export function normalizeArticleCategory(input: string | undefined | null): string {
  const t = typeof input === 'string' ? input.trim() : '';
  if (!t) return 'opinion-commentary';
  return (ARTICLE_CATEGORY_SLUGS as readonly string[]).includes(t)
    ? t
    : 'opinion-commentary';
}

export const STATUS_OPTIONS = ['draft', 'pending', 'pending_editorial', 'published'];
