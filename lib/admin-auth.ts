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

export const CATEGORY_OPTIONS = [
  { value: 'africa-diaspora', label: 'Africa & Diaspora' },
  { value: 'world-politics', label: 'World Politics' },
  { value: 'human-rights', label: 'Human Rights' },
  { value: 'economy', label: 'Economy' },
  { value: 'commentary', label: 'Commentary' },
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

/** Allowed `articles.category` slug values. */
export const ARTICLE_CATEGORY_SLUGS = [
  'africa-diaspora',
  'world-politics',
  'human-rights',
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
  if (!t) return 'commentary';
  return (ARTICLE_CATEGORY_SLUGS as readonly string[]).includes(t) ? t : 'commentary';
}

export const STATUS_OPTIONS = ['draft', 'pending', 'pending_editorial', 'published'];
