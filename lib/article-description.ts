import { storedBodyToEditorMarkdown } from '@/lib/article-markdown';

const MAX_LENGTH = 160;

/** Strip the markdown syntax that would look odd in a search or share preview. */
function plain(line: string): string {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\^[^\]]*\]/g, '')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * First readable paragraph of the body, trimmed to a preview length at a word boundary.
 * Skips headings, rules, bylines and "Published:" lines, which are not prose.
 */
export function descriptionFromBody(body: unknown): string {
  const markdown = storedBodyToEditorMarkdown(body);
  for (const block of markdown.split(/\n\s*\n/)) {
    const first = block.trim();
    if (!first || /^(#{1,6}\s|---|\*\*\*|___|!\[|\||-\s|\d+\.\s)/.test(first)) continue;
    if (/^\*{0,2}\s*by\s/i.test(first) || /^\*?\s*published:/i.test(first)) continue;
    const text = plain(first);
    if (text.length < 40) continue;
    if (text.length <= MAX_LENGTH) return text;
    const cut = text.slice(0, MAX_LENGTH);
    const lastSpace = cut.lastIndexOf(' ');
    return cut.slice(0, lastSpace > 80 ? lastSpace : MAX_LENGTH).replace(/[\s,;:.\-]+$/, '') + '...';
  }
  return '';
}

/** The description search engines and link previews use: excerpt, then subtitle, then the opening text. */
export function articleDescription(article: { excerpt?: string | null; subtitle?: string | null; body?: unknown }): string {
  return (article.excerpt || '').trim() || (article.subtitle || '').trim() || descriptionFromBody(article.body);
}
