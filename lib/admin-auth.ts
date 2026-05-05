export const ADMIN_COOKIE = 'gvn_admin_session';
export const ADMIN_COOKIE_VALUE = 'authenticated';

export function isAdminAuthenticated(): boolean {
  if (typeof document === 'undefined') return false;
  const cookies = document.cookie.split(';');
  return cookies.some(
    (c) => c.trim().startsWith(`${ADMIN_COOKIE}=`) &&
           c.trim().split('=')[1] === ADMIN_COOKIE_VALUE
  );
}

export function setAdminSession() {
  const expires = new Date();
  expires.setHours(expires.getHours() + 8);
  document.cookie = `${ADMIN_COOKIE}=${ADMIN_COOKIE_VALUE}; path=/; expires=${expires.toUTCString()}; SameSite=Strict`;
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

export function bodyTextToJson(text: string): { content: { type: string; text: string }[] } {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ type: 'paragraph', text: p }));
  return { content: paragraphs };
}

export function bodyJsonToText(body: unknown): string {
  if (!body) return '';
  if (typeof body === 'string') return body;
  const b = body as { content?: { type: string; text?: string }[] };
  if (!b.content || !Array.isArray(b.content)) return JSON.stringify(body);
  return b.content
    .filter((block) => block.type === 'paragraph' && block.text)
    .map((block) => block.text)
    .join('\n\n');
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

export const STATUS_OPTIONS = ['draft', 'pending', 'published'];
