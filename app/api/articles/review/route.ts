import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { markdownPlainTextForApis, wordCountMarkdownExcludingSyntax } from '@/lib/article-markdown';
import { CATEGORIES } from '@/lib/supabase';
import { normalizeEditorialCategory, requiresHumanEditorialReview } from '@/lib/editorial-category';

type ReviewOutcome = 'published' | 'pending' | 'pending_editorial' | 'rejected';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getBaseUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

async function triggerRevalidate(req: NextRequest, slug?: string) {
  const baseUrl = getBaseUrl(req);
  await fetch(`${baseUrl}/api/revalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  }).catch(() => {});
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await req.json().catch(() => null);
    const article_id =
      parsed && typeof parsed === 'object' && 'article_id' in parsed
        ? String((parsed as { article_id?: unknown }).article_id || '')
        : '';

    if (!article_id) {
      return NextResponse.json({ error: 'Missing article_id' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    if (!supabase) {
      console.error('[articles/review] Missing Supabase service role configuration');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const { data: article, error: articleErr } = await supabase
      .from('articles')
      .select('*')
      .eq('id', article_id)
      .maybeSingle();

    if (articleErr) {
      console.error('[articles/review] Failed to load article:', articleErr.message);
      return NextResponse.json({ error: articleErr.message }, { status: 400 });
    }
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const editorialCategory = normalizeEditorialCategory(
      (article as Record<string, unknown>).editorial_category,
    );
    if (requiresHumanEditorialReview(editorialCategory)) {
      const { error: upErr } = await supabase
        .from('articles')
        .update({ status: 'pending_editorial', editorial_category: editorialCategory })
        .eq('id', article_id);
      if (upErr) {
        console.error('[articles/review] pending_editorial update failed:', upErr.message);
        return NextResponse.json({ error: upErr.message }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        outcome: 'pending_editorial' satisfies ReviewOutcome,
        message: 'Your article is queued for human editorial review.',
        slug: String((article as Record<string, unknown>).slug || ''),
      });
    }

    const title = String(article.title || '').trim();
    const slug = String(article.slug || '').trim();
    const category = String(article.category || '').trim();
    const bodyText = markdownPlainTextForApis(article.body);
    const wordCountVal = wordCountMarkdownExcludingSyntax(bodyText);

    if (!title) {
      return await applyRejection({
        supabase,
        articleId: article_id,
        articleTitle: title || '(untitled)',
        slug,
        authorEmail: getAuthorEmail(article),
        reason: 'Missing title.',
        notes: 'Please add a clear title and resubmit.',
        moderationScore: { quality_score: 0, recommendation: 'reject', rejection_reason: 'Missing title.' },
      });
    }

    if (!isValidCategory(category)) {
      return await applyRejection({
        supabase,
        articleId: article_id,
        articleTitle: title,
        slug,
        authorEmail: getAuthorEmail(article),
        reason: 'Invalid category.',
        notes: 'Please select a valid category and resubmit.',
        moderationScore: { quality_score: 0, recommendation: 'reject', rejection_reason: 'Invalid category.' },
      });
    }

    if (wordCountVal < 300) {
      return await applyRejection({
        supabase,
        articleId: article_id,
        articleTitle: title,
        slug,
        authorEmail: getAuthorEmail(article),
        reason: 'Article too short. Minimum 300 words required.',
        notes: 'Please expand your article to at least 300 words and resubmit.',
        moderationScore: {
          quality_score: 0,
          recommendation: 'reject',
          rejection_reason: 'Article too short. Minimum 300 words required.',
        },
      });
    }

    const moderation = await runOpenAiModeration(bodyText);
    if (moderation.flagged) {
      return await applyRejection({
        supabase,
        articleId: article_id,
        articleTitle: title,
        slug,
        authorEmail: getAuthorEmail(article),
        reason: moderation.reason,
        notes: 'Your article triggered our content safety filters. Please revise and resubmit.',
        moderationScore: {
          quality_score: 0,
          recommendation: 'reject',
          rejection_reason: moderation.reason,
          editorial_notes: moderation.reason,
        },
      });
    }

    const assessment = await runClaudeQualityReview({ title, category, bodyText });

    const score = clampInt(Number(assessment.quality_score ?? 0), 0, 100);
    const recommendation = String(assessment.recommendation || '').toLowerCase();

    if (score > 70) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('articles')
        .update({
          status: 'published',
          published_at: now,
          moderation_score: assessment,
        })
        .eq('id', article_id);

      if (error) {
        console.error('[articles/review] Publish update failed:', error.message);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      await triggerRevalidate(req, slug);

      await sendOutcomeEmail({
        to: getAuthorEmail(article),
        outcome: 'published',
        title,
        slug,
      });

      return NextResponse.json({
        ok: true,
        outcome: 'published' satisfies ReviewOutcome,
        message: `Your article "${title}" has been published.`,
        url: `https://groundviewnews.com/article/${slug}`,
        slug,
        assessment,
      });
    }

    if (score >= 50 && score <= 70) {
      const { error } = await supabase
        .from('articles')
        .update({
          status: 'pending',
          moderation_score: assessment,
        })
        .eq('id', article_id);

      if (error) {
        console.error('[articles/review] Pending update failed:', error.message);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      const { error: mqErr } = await supabase
        .from('moderation_queue')
        .insert({ article_id, status: 'pending', ai_assessment: assessment });
      if (mqErr) {
        console.error('[articles/review] moderation_queue insert skipped:', mqErr.message);
      }

      await sendOutcomeEmail({
        to: getAuthorEmail(article),
        outcome: 'pending',
        title,
        slug,
      });

      return NextResponse.json({
        ok: true,
        outcome: 'pending' satisfies ReviewOutcome,
        message: `Your article "${title}" is under editorial review.`,
        slug,
        assessment,
      });
    }

    const rejectionReason =
      typeof assessment.rejection_reason === 'string' && assessment.rejection_reason.trim()
        ? assessment.rejection_reason.trim()
        : recommendation === 'reject'
          ? 'Article did not meet our editorial quality threshold.'
          : 'Article did not meet our editorial quality threshold.';

    return await applyRejection({
      supabase,
      articleId: article_id,
      articleTitle: title,
      slug,
      authorEmail: getAuthorEmail(article),
      reason: rejectionReason,
      notes: String(assessment.editorial_notes || '').trim(),
      moderationScore: assessment,
    });
  } catch (e) {
    console.error('[articles/review] Uncaught error:', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}

function isValidCategory(category: string): boolean {
  return CATEGORIES.some((c) => c.slug === category);
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function getAuthorEmail(article: Record<string, unknown>): string | undefined {
  const candidates = [
    article.author_email,
    article.email,
    article.authorEmail,
  ].filter(Boolean);
  const found = candidates.find((v) => typeof v === 'string' && String(v).includes('@'));
  return typeof found === 'string' ? found : undefined;
}

async function applyRejection(args: {
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>;
  articleId: string;
  articleTitle: string;
  slug: string;
  authorEmail?: string;
  reason: string;
  notes?: string;
  moderationScore?: unknown;
}) {
  const { supabase, articleId, articleTitle, slug, authorEmail, reason, notes, moderationScore } =
    args;
  const { error } = await supabase
    .from('articles')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      moderation_score: moderationScore,
    })
    .eq('id', articleId);

  if (error) {
    console.error('[articles/review] Rejection update failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await sendOutcomeEmail({
    to: authorEmail,
    outcome: 'rejected',
    title: articleTitle,
    slug,
    reason,
    notes,
  });

  return NextResponse.json({
    ok: true,
    outcome: 'rejected' satisfies ReviewOutcome,
    message: `Your article "${articleTitle}" was not accepted.`,
    reason,
    notes,
    slug,
  });
}

async function sendOutcomeEmail(args: {
  to?: string;
  outcome: ReviewOutcome;
  title: string;
  slug: string;
  reason?: string;
  notes?: string;
}) {
  if (!args.to) return;

  if (args.outcome === 'published') {
    await sendEmail(
      args.to,
      `Your article has been published: ${args.title}`,
      `<p>Your article '<strong>${escapeHtml(args.title)}</strong>' has been published at <a href="https://groundviewnews.com/article/${escapeHtml(args.slug)}">groundviewnews.com/article/${escapeHtml(args.slug)}</a>.</p>`
    );
    return;
  }

  if (args.outcome === 'pending') {
    await sendEmail(
      args.to,
      `Your article is under review: ${args.title}`,
      `<p>Your article '<strong>${escapeHtml(args.title)}</strong>' is under editorial review. You will hear back within 24 hours.</p>`
    );
    return;
  }

  await sendEmail(
    args.to,
    `Your article was not accepted: ${args.title}`,
    `<p>Your article '<strong>${escapeHtml(args.title)}</strong>' was not accepted.</p>
<p><strong>Reason:</strong> ${escapeHtml(args.reason || 'Not specified')}</p>
${args.notes ? `<p><strong>Editorial notes:</strong> ${escapeHtml(args.notes)}</p>` : ''}
<p>You may revise and resubmit.</p>`
  );
}

async function runOpenAiModeration(text: string): Promise<{ flagged: boolean; reason: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[articles/review] OPENAI_API_KEY missing — skipping moderation');
    return { flagged: false, reason: '' };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: text,
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('[articles/review] OpenAI moderation HTTP error:', res.status, t);
      return { flagged: false, reason: '' };
    }

    const data = (await res.json().catch((e: unknown) => {
      console.error('[articles/review] OpenAI moderation JSON parse failed:', String(e));
      return null;
    })) as { results?: { categories?: Record<string, boolean> }[] } | null;

    const result = data?.results?.[0];
    if (!result) return { flagged: false, reason: '' };

    const categories = result.categories || {};
    const flagged =
      Boolean(categories['hate']) ||
      Boolean(categories['harassment']) ||
      Boolean(categories['violence']) ||
      Boolean(categories['sexual']) ||
      Boolean(categories['self-harm']);

    if (!flagged) return { flagged: false, reason: '' };

    const triggered = [
      categories['hate'] ? 'hate speech' : null,
      categories['harassment'] ? 'harassment' : null,
      categories['violence'] ? 'violence' : null,
      categories['sexual'] ? 'sexual content' : null,
      categories['self-harm'] ? 'self-harm' : null,
    ].filter(Boolean);

    return { flagged: true, reason: `Content moderation flagged: ${triggered.join(', ')}` };
  } catch (e) {
    console.error('[articles/review] OpenAI moderation request failed:', e);
    return { flagged: false, reason: '' };
  }
}

const CLAUDE_FAIL_OPEN = {
  quality_score: 75,
  factual_flags: [] as string[],
  editorial_notes: 'Automated editorial scoring unavailable — article approved.',
  recommendation: 'approve',
  rejection_reason: '',
};

async function runClaudeQualityReview(input: { title: string; category: string; bodyText: string }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[articles/review] ANTHROPIC_API_KEY missing — using fail-open approve score');
    return CLAUDE_FAIL_OPEN;
  }

  const systemPrompt = `You are an editorial quality reviewer for a serious global news commentary publication. Review the following article and return a JSON object with these fields:
- quality_score: integer 0-100 (writing quality, clarity, structure, argument strength)
- factual_flags: array of strings (specific claims that should be fact-checked before publishing)
- editorial_notes: string (brief editorial feedback for the journalist)
- recommendation: one of: approve, review, reject
- rejection_reason: string (only if recommendation is reject)

Score above 70 = approve. Score 50-70 = review (needs human check). Score below 50 = reject.

Return ONLY valid JSON.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Title: ${input.title}\nCategory: ${input.category}\n\nArticle:\n${input.bodyText}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('[articles/review] Claude HTTP error:', res.status, t);
      return CLAUDE_FAIL_OPEN;
    }

    const data = (await res.json().catch((e: unknown) => {
      console.error('[articles/review] Claude JSON parse failed:', String(e));
      return null;
    })) as { content?: { type?: string; text?: string }[] } | null;

    const text = data?.content?.find((c: { type?: string }) => c?.type === 'text')?.text;
    if (typeof text !== 'string') {
      console.error('[articles/review] Claude response missing text block');
      return CLAUDE_FAIL_OPEN;
    }

    const parsed = safeJsonParse(text);
    if (!parsed) {
      console.error('[articles/review] Claude response was not valid JSON');
      return CLAUDE_FAIL_OPEN;
    }

    return parsed;
  } catch (e) {
    console.error('[articles/review] Claude request failed:', e);
    return CLAUDE_FAIL_OPEN;
  }
}

function safeJsonParse(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
