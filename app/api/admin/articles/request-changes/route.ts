import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { isAdminServerSession } from '@/lib/admin-server';
import { sendEmail } from '@/lib/email';
import { WRITER_EMAIL_FROM, articleChangesRequestedEmail } from '@/lib/writer-emails';
import { siteUrl } from '@/lib/email-branding';
import { storedBodyToEditorMarkdown } from '@/lib/article-markdown';
import {
  FEEDBACK_MAX_ITEMS,
  FEEDBACK_MAX_ITEM_LENGTH,
  FEEDBACK_MAX_NOTE_LENGTH,
} from '@/lib/article-feedback-presets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST: the editor sends comments on a writer's article. Saves the feedback
 * round with a snapshot of the article as it is now, returns the article to
 * the writer as an editable draft, and emails them what is missing.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminServerSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const body = (await req.json().catch(() => null)) as {
    article_id?: unknown;
    items?: unknown;
    note?: unknown;
  } | null;
  const articleId = typeof body?.article_id === 'string' ? body.article_id.trim() : '';
  if (!articleId) return NextResponse.json({ error: 'Missing article_id' }, { status: 400 });

  const items = (Array.isArray(body?.items) ? body!.items : [])
    .map((i) => (typeof i === 'string' ? i.trim() : ''))
    .filter(Boolean);
  if (items.length === 0) {
    return NextResponse.json({ error: 'Add at least one comment for the writer.' }, { status: 400 });
  }
  if (items.length > FEEDBACK_MAX_ITEMS || items.some((i) => i.length > FEEDBACK_MAX_ITEM_LENGTH)) {
    return NextResponse.json(
      { error: `Use at most ${FEEDBACK_MAX_ITEMS} comments of ${FEEDBACK_MAX_ITEM_LENGTH} characters each.` },
      { status: 400 }
    );
  }
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  if (note.length > FEEDBACK_MAX_NOTE_LENGTH) {
    return NextResponse.json({ error: `The note must be ${FEEDBACK_MAX_NOTE_LENGTH} characters or fewer.` }, { status: 400 });
  }

  const { data: article, error: artErr } = await supabase
    .from('articles')
    .select('id, title, subtitle, excerpt, body, status, author_id, author_email')
    .eq('id', articleId)
    .maybeSingle();
  if (artErr) return NextResponse.json({ error: artErr.message }, { status: 400 });
  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 });

  const row = article as {
    id: string;
    title: string;
    subtitle: string | null;
    excerpt: string | null;
    body: unknown;
    status: string;
    author_id: string | null;
    author_email: string | null;
  };

  if (row.status === 'published') {
    return NextResponse.json({ error: 'This article is already published. Unpublish it first.' }, { status: 400 });
  }
  if (!row.author_id) {
    return NextResponse.json({ error: 'This article has no writer account to send feedback to.' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', row.author_id)
    .maybeSingle();
  const prof = profile as { full_name?: string | null; email?: string | null } | null;
  const writerEmail = (row.author_email || prof?.email || '').trim();
  if (!writerEmail) {
    return NextResponse.json({ error: 'No email address on file for this writer.' }, { status: 400 });
  }

  const { data: last } = await supabase
    .from('article_feedback')
    .select('round')
    .eq('article_id', articleId)
    .order('round', { ascending: false })
    .limit(1)
    .maybeSingle();
  const round = ((last as { round?: number } | null)?.round || 0) + 1;

  const { data: inserted, error: insErr } = await supabase
    .from('article_feedback')
    .insert({
      article_id: articleId,
      round,
      items,
      note: note || null,
      snapshot: {
        title: row.title || '',
        subtitle: row.subtitle || '',
        excerpt: row.excerpt || '',
        markdown: storedBodyToEditorMarkdown(row.body),
      },
    })
    .select('id')
    .single();
  if (insErr || !inserted) {
    return NextResponse.json({ error: insErr?.message || 'Could not save feedback' }, { status: 400 });
  }
  const feedbackId = (inserted as { id: string }).id;

  const { error: upErr } = await supabase
    .from('articles')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('id', articleId);
  if (upErr) {
    await supabase.from('article_feedback').delete().eq('id', feedbackId);
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  const email = articleChangesRequestedEmail({
    fullName: prof?.full_name || '',
    articleTitle: row.title || 'Your article',
    items,
    note,
    editUrl: `${siteUrl()}/journalists/submit?id=${encodeURIComponent(articleId)}`,
  });
  const emailSent = await sendEmail(writerEmail, email.subject, email.html, WRITER_EMAIL_FROM);
  await supabase.from('article_feedback').update({ email_sent: emailSent }).eq('id', feedbackId);

  return NextResponse.json({ ok: true, round, email_sent: emailSent });
}

/** GET: the latest feedback round for every article that has had feedback, for the admin dashboard badges. */
export async function GET() {
  if (!(await isAdminServerSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const { data, error } = await supabase
    .from('article_feedback')
    .select('article_id, round, sent_at, resubmitted_at, email_sent')
    .order('round', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const latest: Record<string, { round: number; sent_at: string; resubmitted_at: string | null; email_sent: boolean }> = {};
  for (const r of (data || []) as Array<{
    article_id: string;
    round: number;
    sent_at: string;
    resubmitted_at: string | null;
    email_sent: boolean;
  }>) {
    if (!latest[r.article_id]) {
      latest[r.article_id] = {
        round: r.round,
        sent_at: r.sent_at,
        resubmitted_at: r.resubmitted_at,
        email_sent: r.email_sent,
      };
    }
  }
  return NextResponse.json({ feedback: latest });
}
