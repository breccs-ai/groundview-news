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

export const LABEL_OPTIONS = [
  'Commentary',
  'Opinion',
  'In Depth',
  'Analysis',
  'Editorial',
];

export const STATUS_OPTIONS = ['draft', 'pending', 'pending_editorial', 'published'];
