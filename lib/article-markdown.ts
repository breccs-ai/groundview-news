/**
 * Article `body` jsonb: prefer `{ markdown: string }`.
 * Legacy `{ content: [...] }` is converted to approximate Markdown for editing.
 */

type LegacyBlock = {
  type?: string;
  text?: string;
  level?: number;
  ordered?: boolean;
  items?: string[];
  url?: string;
  caption?: string;
};

export function markdownBodyPayload(markdown: string): { markdown: string } {
  return { markdown: markdown ?? '' };
}

/** Prefer body.markdown; else legacy blocks → markdown-like text; else raw string. */
export function storedBodyToEditorMarkdown(body: unknown): string {
  if (!body) return '';
  if (typeof body === 'string') return body;

  if (typeof body === 'object' && body !== null) {
    const o = body as Record<string, unknown>;
    if (typeof o.markdown === 'string') return o.markdown;
    if (Array.isArray(o.content)) {
      return legacyBlocksToMarkdown(o.content as LegacyBlock[]);
    }
  }

  return '';
}

/** Word-count helper: strip markdown punctuation per product spec. */
export function stripMarkdownForWordCount(text: string): string {
  return text.replace(/[#*_`\[\]()>-]/g, '');
}

export function wordCountMarkdownExcludingSyntax(markdown: string): number {
  const t = stripMarkdownForWordCount(markdown).trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

export function markdownPlainTextForApis(body: unknown): string {
  return storedBodyToEditorMarkdown(body);
}

function legacyBlocksToMarkdown(blocks: LegacyBlock[]): string {
  const out: string[] = [];
  for (const block of blocks) {
    if (!block?.type) continue;
    switch (block.type) {
      case 'paragraph':
        if (block.text) out.push(block.text);
        break;
      case 'heading': {
        const lvl = block.level === 3 ? 3 : 2;
        const prefix = lvl === 3 ? '### ' : '## ';
        if (block.text) out.push(`${prefix}${block.text}`);
        break;
      }
      case 'quote':
        if (block.text) out.push(`> ${block.text}`);
        break;
      case 'divider':
        out.push('---');
        break;
      case 'list':
        if (Array.isArray(block.items)) {
          for (const item of block.items) {
            out.push(`- ${item}`);
          }
        }
        break;
      case 'image':
        if (block.url) {
          out.push(`![${block.caption || ''}](${block.url})`);
        }
        break;
      default:
        if (block.text) out.push(block.text);
    }
  }
  return out.join('\n\n');
}
