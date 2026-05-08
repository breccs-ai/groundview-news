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

export type BodyBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level?: number; text: string }
  | { type: 'quote'; text: string }
  | { type: 'divider' }
  | { type: 'list'; ordered?: boolean; items: string[] };

export function bodyTextToJson(text: string): { content: BodyBlock[] } {
  const raw = (text || '').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');

  const blocks: BodyBlock[] = [];
  let i = 0;

  const flushParagraph = (buf: string[]) => {
    const t = buf.join('\n').trim();
    if (t) blocks.push({ type: 'paragraph', text: t });
    buf.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Skip blank lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Divider
    if (trimmed === '---') {
      blocks.push({ type: 'divider' });
      i++;
      continue;
    }

    // Headings (### then ##)
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'heading', level: 3, text: trimmed.slice(4).trim() });
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'heading', level: 2, text: trimmed.slice(3).trim() });
      i++;
      continue;
    }

    // Quote: collect consecutive > lines
    if (trimmed.startsWith('>')) {
      const q: string[] = [];
      while (i < lines.length) {
        const t = (lines[i] ?? '').trim();
        if (!t.startsWith('>')) break;
        q.push(t.replace(/^>\s?/, '').trim());
        i++;
      }
      const qt = q.join(' ').trim();
      if (qt) blocks.push({ type: 'quote', text: qt });
      continue;
    }

    // Unordered list: collect consecutive "- " lines
    if (trimmed.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length) {
        const t = (lines[i] ?? '').trim();
        if (!t.startsWith('- ')) break;
        const item = t.slice(2).trim();
        if (item) items.push(item);
        i++;
      }
      if (items.length) blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    // Paragraph: collect until blank line
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? '';
      const t = l.trim();
      if (!t) break;
      // stop paragraph if a new block starts
      if (t === '---' || t.startsWith('## ') || t.startsWith('### ') || t.startsWith('>') || t.startsWith('- ')) break;
      para.push(l);
      i++;
    }
    flushParagraph(para);
  }

  return { content: blocks };
}

export function bodyJsonToText(body: unknown): string {
  if (!body) return '';
  if (typeof body === 'string') return body;
  const b = body as { content?: { type: string; text?: string; level?: number; ordered?: boolean; items?: string[] }[] };
  if (!b.content || !Array.isArray(b.content)) return JSON.stringify(body);

  const out: string[] = [];
  for (const block of b.content) {
    if (block.type === 'paragraph' && block.text) {
      out.push(block.text);
      continue;
    }
    if (block.type === 'heading' && block.text) {
      const lvl = block.level === 3 ? 3 : 2;
      out.push(`${lvl === 3 ? '###' : '##'} ${block.text}`);
      continue;
    }
    if (block.type === 'quote' && block.text) {
      out.push(`> ${block.text}`);
      continue;
    }
    if (block.type === 'divider') {
      out.push('---');
      continue;
    }
    if (block.type === 'list' && Array.isArray(block.items)) {
      for (const item of block.items) {
        out.push(`- ${item}`);
      }
      continue;
    }
  }
  return out.join('\n\n');
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
