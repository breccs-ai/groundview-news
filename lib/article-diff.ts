import { wordCountMarkdownExcludingSyntax } from '@/lib/article-markdown';
import { escapeHtml } from '@/lib/email-branding';

export type ArticleSnapshot = {
  title: string;
  subtitle: string;
  excerpt: string;
  markdown: string;
};

export type DiffBlock =
  | { kind: 'unchanged'; count: number }
  | { kind: 'added'; text: string }
  | { kind: 'removed'; text: string }
  | { kind: 'modified'; before: string; after: string; inline: InlinePart[] | null };

export type InlinePart = { type: 'same' | 'added' | 'removed'; text: string };

export type DiffStats = {
  wordsBefore: number;
  wordsAfter: number;
  linksBefore: number;
  linksAfter: number;
  paragraphsAdded: number;
  paragraphsRemoved: number;
  paragraphsModified: number;
};

export type FieldChange = { field: 'title' | 'subtitle' | 'excerpt'; before: string; after: string };

export type ArticleDiff = {
  stats: DiffStats;
  fieldChanges: FieldChange[];
  blocks: DiffBlock[];
  hasChanges: boolean;
};

const URL_RE = /https?:\/\/[^\s)\]>"']+/g;

export function extractUrls(markdown: string): string[] {
  const found = (markdown || '').match(URL_RE) || [];
  const cleaned = found.map((u) => u.replace(/[.,;:!?]+$/, ''));
  return Array.from(new Set(cleaned));
}

export function splitParagraphs(markdown: string): string[] {
  return (markdown || '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

type Op<T> = { op: 'equal' | 'removed' | 'added'; value: T };

// Longest-common-subsequence diff. Inputs here are paragraph lists or word
// lists, so the quadratic table stays small.
function lcsDiff<T>(a: T[], b: T[]): Op<T>[] {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const out: Op<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: 'equal', value: a[i] });
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      out.push({ op: 'removed', value: a[i] });
      i++;
    } else {
      out.push({ op: 'added', value: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ op: 'removed', value: a[i++] });
  while (j < m) out.push({ op: 'added', value: b[j++] });
  return out;
}

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function similarity(a: string, b: string): number {
  const wa = new Set(words(a.toLowerCase()));
  const wb = new Set(words(b.toLowerCase()));
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  wa.forEach((w) => {
    if (wb.has(w)) shared++;
  });
  return shared / (wa.size + wb.size - shared);
}

const INLINE_CELL_LIMIT = 1_500_000;

function inlineDiff(before: string, after: string): InlinePart[] | null {
  const wa = words(before);
  const wb = words(after);
  if (wa.length * wb.length > INLINE_CELL_LIMIT) return null;
  const parts: InlinePart[] = [];
  for (const o of lcsDiff(wa, wb)) {
    const type = o.op === 'equal' ? 'same' : o.op;
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += ` ${o.value}`;
    else parts.push({ type, text: o.value });
  }
  return parts;
}

export function diffArticle(before: ArticleSnapshot, after: ArticleSnapshot): ArticleDiff {
  const pa = splitParagraphs(before.markdown);
  const pb = splitParagraphs(after.markdown);
  const ops = lcsDiff(pa, pb);

  const blocks: DiffBlock[] = [];
  let paragraphsAdded = 0;
  let paragraphsRemoved = 0;
  let paragraphsModified = 0;

  let idx = 0;
  while (idx < ops.length) {
    if (ops[idx].op === 'equal') {
      let count = 0;
      while (idx < ops.length && ops[idx].op === 'equal') {
        count++;
        idx++;
      }
      blocks.push({ kind: 'unchanged', count });
      continue;
    }
    const removed: string[] = [];
    const added: string[] = [];
    while (idx < ops.length && ops[idx].op !== 'equal') {
      if (ops[idx].op === 'removed') removed.push(ops[idx].value);
      else added.push(ops[idx].value);
      idx++;
    }
    // Pair an edited paragraph with its replacement so the reader sees one
    // inline change instead of a delete plus an unrelated insert.
    const usedAdded = new Set<number>();
    const pairs: Array<{ r: number; a: number }> = [];
    removed.forEach((r, ri) => {
      let best = -1;
      let bestScore = 0.3;
      added.forEach((a, ai) => {
        if (usedAdded.has(ai)) return;
        const s = similarity(r, a);
        if (s >= bestScore) {
          best = ai;
          bestScore = s;
        }
      });
      if (best >= 0) {
        usedAdded.add(best);
        pairs.push({ r: ri, a: best });
      }
    });
    const pairedRemoved = new Map(pairs.map((p) => [p.r, p.a]));
    removed.forEach((r, ri) => {
      const ai = pairedRemoved.get(ri);
      if (ai !== undefined) {
        paragraphsModified++;
        blocks.push({ kind: 'modified', before: r, after: added[ai], inline: inlineDiff(r, added[ai]) });
      } else {
        paragraphsRemoved++;
        blocks.push({ kind: 'removed', text: r });
      }
    });
    added.forEach((a, ai) => {
      if (usedAdded.has(ai)) return;
      paragraphsAdded++;
      blocks.push({ kind: 'added', text: a });
    });
  }

  const fieldChanges: FieldChange[] = [];
  for (const field of ['title', 'subtitle', 'excerpt'] as const) {
    const b = (before[field] || '').trim();
    const a = (after[field] || '').trim();
    if (b !== a) fieldChanges.push({ field, before: b, after: a });
  }

  const stats: DiffStats = {
    wordsBefore: wordCountMarkdownExcludingSyntax(before.markdown),
    wordsAfter: wordCountMarkdownExcludingSyntax(after.markdown),
    linksBefore: extractUrls(before.markdown).length,
    linksAfter: extractUrls(after.markdown).length,
    paragraphsAdded,
    paragraphsRemoved,
    paragraphsModified,
  };

  const hasChanges =
    fieldChanges.length > 0 || blocks.some((b) => b.kind !== 'unchanged');

  return { stats, fieldChanges, blocks, hasChanges };
}

const ADD_STYLE = 'background:#dcfce7;color:#14532d;';
const DEL_STYLE = 'background:#fee2e2;color:#7f1d1d;text-decoration:line-through;';
const PARA_STYLE =
  'margin:0 0 10px 0;padding:8px 10px;border-radius:3px;font-size:13px;line-height:1.55;font-family:Arial,Helvetica,sans-serif;';

const MAX_RENDERED_BLOCKS = 40;

export function renderDiffHtml(diff: ArticleDiff): string {
  const parts: string[] = [];

  for (const f of diff.fieldChanges) {
    parts.push(
      `<p style="${PARA_STYLE}background:#f3f4f6;"><strong>${f.field} changed</strong><br/>` +
        `<span style="${DEL_STYLE}">${escapeHtml(f.before || '(empty)')}</span><br/>` +
        `<span style="${ADD_STYLE}">${escapeHtml(f.after || '(empty)')}</span></p>`
    );
  }

  let rendered = 0;
  let omitted = 0;
  for (const b of diff.blocks) {
    if (b.kind === 'unchanged') {
      parts.push(
        `<p style="margin:0 0 10px 0;color:#9ca3af;font-size:12px;font-family:Arial,Helvetica,sans-serif;">${b.count} unchanged paragraph${b.count === 1 ? '' : 's'}</p>`
      );
      continue;
    }
    if (rendered >= MAX_RENDERED_BLOCKS) {
      omitted++;
      continue;
    }
    rendered++;
    if (b.kind === 'added') {
      parts.push(`<p style="${PARA_STYLE}${ADD_STYLE}"><strong>Added:</strong> ${escapeHtml(b.text)}</p>`);
    } else if (b.kind === 'removed') {
      parts.push(`<p style="${PARA_STYLE}${DEL_STYLE}"><strong>Removed:</strong> ${escapeHtml(b.text)}</p>`);
    } else if (b.inline) {
      const inline = b.inline
        .map((p) =>
          p.type === 'same'
            ? escapeHtml(p.text)
            : `<span style="${p.type === 'added' ? ADD_STYLE : DEL_STYLE}">${escapeHtml(p.text)}</span>`
        )
        .join(' ');
      parts.push(`<p style="${PARA_STYLE}background:#f9fafb;border:1px solid #e5e7eb;"><strong>Edited:</strong> ${inline}</p>`);
    } else {
      parts.push(
        `<p style="${PARA_STYLE}background:#f9fafb;border:1px solid #e5e7eb;"><strong>Edited (before):</strong> <span style="${DEL_STYLE}">${escapeHtml(b.before)}</span><br/><strong>After:</strong> <span style="${ADD_STYLE}">${escapeHtml(b.after)}</span></p>`
      );
    }
  }
  if (omitted > 0) {
    parts.push(
      `<p style="margin:0 0 10px 0;color:#6b7280;font-size:12px;font-family:Arial,Helvetica,sans-serif;">...and ${omitted} more changed paragraph${omitted === 1 ? '' : 's'}. Open the article in the admin dashboard to see everything.</p>`
    );
  }

  return parts.join('\n');
}
