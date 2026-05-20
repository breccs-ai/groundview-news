import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import {
  WRITER_EMAIL_FROM,
  articleApprovedForPublishEmail,
  siteUrl,
} from '@/lib/writer-emails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_COOKIE = 'gvn_admin_session';
const ADMIN_COOKIE_VALUE = 'authenticated';

function isAdmin(): boolean {
  return cookies().get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE;
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { article_id?: string };
  const articleId = String(body.article_id || '').trim();
  if (!articleId) {
    return NextResponse.json({ error: 'Missing article_id.' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });
  }

  const { data: article, error: fetchErr } = await supabase
    .from('articles')
    .select('id, title, slug, status, author_id, author_email')
    .eq('id', articleId)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 400 });
  }
  if (!article) {
    return NextResponse.json({ error: 'Article not found.' }, { status: 404 });
  }

  const articleRow = article as {
    id: string;
    title: string;
    slug: string;
    status: string;
    author_id: string | null;
    author_email: string | null;
  };

  const { error: updateErr } = await supabase
    .from('articles')
    .update({ status: 'approved_pending_publish' })
    .eq('id', articleRow.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  let writerFullName = '';
  let writerEmail = articleRow.author_email || '';

  if (articleRow.author_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', articleRow.author_id)
      .maybeSingle();
    const row = profile as { full_name?: string; email?: string } | null;
    writerFullName = row?.full_name || '';
    if (!writerEmail) writerEmail = row?.email || '';
  }

  if (writerEmail) {
    const editorUrl = `${siteUrl()}/journalists/dashboard?article=${encodeURIComponent(articleRow.id)}`;
    const email = articleApprovedForPublishEmail({
      fullName: writerFullName,
      articleTitle: articleRow.title || 'Your article',
      articleEditUrl: editorUrl,
    });
    await sendEmail(writerEmail, email.subject, email.html, WRITER_EMAIL_FROM);
  }

  return NextResponse.json({ ok: true, status: 'approved_pending_publish' });
}
