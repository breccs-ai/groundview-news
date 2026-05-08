import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { bodyJsonToText } from '@/lib/admin-auth';
import { CATEGORIES } from '@/lib/supabase';

type ReviewOutcome = 'published' | 'pending' | 'rejected';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
  const { article_id } = (await req.json().catch(() => ({}))) as { article_id?: string };
  if (!article_id) {
    return NextResponse.json({ error: 'Missing article_id' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data: article, error: articleErr } = await supabase
    .from('articles')
    .select('*')
    .eq('id', article_id)
    .maybeSingle();

  if (articleErr || !article) {
    return NextResponse.json({ error: articleErr?.message || 'Article not found' }, { status: 404 });
  }

  const title = String(article.title || '').trim();
  const slug = String(article.slug || '').trim();
  const category = String(article.category || '').trim();
  const bodyText = bodyJsonToText(article.body);
  const wordCount = countWords(bodyText);

  // Step 1 — Basic checks
  if (!title) {
    return await applyRejection({
      req,
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
      req,
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
  if (wordCount < 300) {
    return await applyRejection({
      req,
      supabase,
      articleId: article_id,
      articleTitle: title,
      slug,
      authorEmail: getAuthorEmail(article),
      reason: 'Article too short. Minimum 300 words required.',
      notes: 'Please expand your article to at least 300 words and resubmit.',
      moderationScore: { quality_score: 0, recommendation: 'reject', rejection_reason: 'Article too short. Minimum 300 words required.' },
    });
  }

  // Step 2 — Content moderation (OpenAI)
  const moderation = await runOpenAiModeration(bodyText);
  if (moderation.flagged) {
    return await applyRejection({
      req,
      supabase,
      articleId: article_id,
      articleTitle: title,
      slug,
      authorEmail: getAuthorEmail(article),
      reason: moderation.reason,
      notes: 'Your article triggered our content safety filters. Please revise and resubmit.',
      moderationScore: { quality_score: 0, recommendation: 'reject', rejection_reason: moderation.reason, editorial_notes: moderation.reason },
    });
  }

  // Step 3 — AI quality scoring (Claude)
  const assessment = await runClaudeQualityReview({ title, category, bodyText });

  // Step 4 — Apply result
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
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Add to moderation queue if table exists in your DB (safe: failures won't block the core flow)
    await supabase.from('moderation_queue').insert({ article_id, status: 'pending', ai_assessment: assessment }).catch(() => {});

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
    req,
    supabase,
    articleId: article_id,
    articleTitle: title,
    slug,
    authorEmail: getAuthorEmail(article),
    reason: rejectionReason,
    notes: String(assessment.editorial_notes || '').trim(),
    moderationScore: assessment,
  });
}

function isValidCategory(category: string): boolean {
  return CATEGORIES.some((c) => c.slug === category);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function getAuthorEmail(article: any): string | undefined {
  const email = article?.author_email || article?.email || article?.authorEmail;
  return typeof email === 'string' && email.includes('@') ? email : undefined;
}

async function applyRejection(args: {
  req: NextRequest;
  supabase: ReturnType<typeof getServiceSupabase>;
  articleId: string;
  articleTitle: string;
  slug: string;
  authorEmail?: string;
  reason: string;
  notes?: string;
  moderationScore?: unknown;
}) {
  const { req, supabase, articleId, articleTitle, slug, authorEmail, reason, notes, moderationScore } = args;
  const { error } = await supabase
    .from('articles')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      moderation_score: moderationScore,
    })
    .eq('id', articleId);

  if (error) {
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
${args.notes ? `<p><strong>Editorial notes:</strong> ${escapeHtml(args.notes)}</p>` : '' }
<p>You may revise and resubmit.</p>`
  );
}

async function runOpenAiModeration(text: string): Promise<{ flagged: boolean; reason: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { flagged: false, reason: '' };

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
    return { flagged: false, reason: '' };
  }

  const data = (await res.json().catch(() => null)) as any;
  const result = data?.results?.[0];
  if (!result) return { flagged: false, reason: '' };

  const categories = result.categories || {};
  const flagged =
    Boolean(categories.hate) ||
    Boolean(categories.harassment) ||
    Boolean(categories.violence) ||
    Boolean(categories['sexual']) ||
    Boolean(categories['self-harm']);

  if (!flagged) return { flagged: false, reason: '' };

  const triggered = [
    categories.hate ? 'hate speech' : null,
    categories.harassment ? 'harassment' : null,
    categories.violence ? 'violence' : null,
    categories['sexual'] ? 'sexual content' : null,
    categories['self-harm'] ? 'self-harm' : null,
  ].filter(Boolean);

  return { flagged: true, reason: `Content moderation flagged: ${triggered.join(', ')}` };
}

async function runClaudeQualityReview(input: { title: string; category: string; bodyText: string }): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      quality_score: 50,
      factual_flags: [],
      editorial_notes: 'AI review unavailable (missing ANTHROPIC_API_KEY). Sent to human review.',
      recommendation: 'review',
      rejection_reason: '',
    };
  }

  const systemPrompt = `You are an editorial quality reviewer for a serious global news commentary publication. Review the following article and return a JSON object with these fields:
- quality_score: integer 0-100 (writing quality, clarity, structure, argument strength)
- factual_flags: array of strings (specific claims that should be fact-checked before publishing)
- editorial_notes: string (brief editorial feedback for the journalist)
- recommendation: one of: approve, review, reject
- rejection_reason: string (only if recommendation is reject)

Score above 70 = approve. Score 50-70 = review (needs human check). Score below 50 = reject.

Return ONLY valid JSON.`;

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
    return {
      quality_score: 50,
      factual_flags: [],
      editorial_notes: 'AI review failed. Sent to human review.',
      recommendation: 'review',
      rejection_reason: '',
    };
  }

  const data = (await res.json().catch(() => null)) as any;
  const text = data?.content?.find?.((c: any) => c?.type === 'text')?.text;
  if (typeof text !== 'string') {
    return {
      quality_score: 50,
      factual_flags: [],
      editorial_notes: 'AI review returned an unexpected response. Sent to human review.',
      recommendation: 'review',
      rejection_reason: '',
    };
  }

  const parsed = safeJsonParse(text);
  if (!parsed) {
    return {
      quality_score: 50,
      factual_flags: [],
      editorial_notes: 'AI review response was not valid JSON. Sent to human review.',
      recommendation: 'review',
      rejection_reason: '',
    };
  }

  return parsed;
}

function safeJsonParse(text: string): any | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
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

