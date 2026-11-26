import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { isAdminServerSession } from '@/lib/admin-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIST_COLUMNS =
  'id, title, slug, category, label, status, published_at, created_at, author_name, author_id';

/**
 * Admin article list and status actions. The admin dashboard used to do these
 * straight from the browser with the public database key, which meant anyone
 * could do them; they now run here, behind the signed admin session.
 */
export async function GET() {
  if (!(await isAdminServerSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const { data, error } = await supabase
    .from('articles')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ articles: data || [] });
}

const ACTIONS = ['reject', 'publish', 'unpublish'] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(req: NextRequest) {
  if (!(await isAdminServerSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const body = (await req.json().catch(() => null)) as { action?: unknown; article_id?: unknown } | null;
  const action = body?.action as Action;
  const articleId = typeof body?.article_id === 'string' ? body.article_id.trim() : '';
  if (!articleId || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { data: article, error: fetchErr } = await supabase
    .from('articles')
    .select('id, slug, published_at')
    .eq('id', articleId)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 400 });
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const row = article as { slug: string; published_at: string | null };
  const now = new Date().toISOString();
  const update =
    action === 'publish'
      ? { status: 'published', published_at: row.published_at || now }
      : action === 'reject'
        ? { status: 'rejected' }
        : { status: 'draft' };

  const { error } = await supabase.from('articles').update(update).eq('id', articleId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, slug: row.slug });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminServerSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const body = (await req.json().catch(() => null)) as { article_id?: unknown } | null;
  const articleId = typeof body?.article_id === 'string' ? body.article_id.trim() : '';
  if (!articleId) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const { error } = await supabase.from('articles').delete().eq('id', articleId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
