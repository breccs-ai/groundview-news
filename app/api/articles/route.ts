import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { resolveArticlesActor } from '@/lib/articles-api-auth';
import { normalizeEditorialCategory, requiresHumanEditorialReview } from '@/lib/editorial-category';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function triggerRevalidate(req: NextRequest, slug?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  await fetch(`${baseUrl}/api/revalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  }).catch(() => {});
}

function slugBase(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return s || 'article';
}

function uniqueSlugPart(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Journalist submit-for-review: route status by editorial_category before DB write. */
function applyJournalistEditorialRouting(payload: Record<string, unknown>) {
  const ec = normalizeEditorialCategory(payload.editorial_category);
  payload.editorial_category = ec;

  const st = payload.status;
  if (st !== 'pending' && st !== 'pending_editorial') return;

  if (requiresHumanEditorialReview(ec)) {
    payload.status = 'pending_editorial';
  } else {
    payload.status = 'pending';
  }
}

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveArticlesActor(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id query parameter' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    if (!supabase) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

    if (actor.kind === 'admin') {
      const { data, error } = await supabase.from('articles').select('*').eq('id', id).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ article: data });
    }

    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .eq('author_id', actor.user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ article: data });
  } catch (e) {
    console.error('[articles GET]', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await resolveArticlesActor(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const incoming = await req.json().catch(() => null);
    if (!incoming || typeof incoming !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let payload = { ...(incoming as Record<string, unknown>) };

    if (actor.kind === 'journalist') {
      const aid = payload.author_id;
      if (!aid || typeof aid !== 'string' || aid !== actor.user.id) {
        return NextResponse.json({ error: 'author_id must match the signed-in user.' }, { status: 403 });
      }
      const email =
        actor.user.email && typeof actor.user.email === 'string' ? actor.user.email : '';
      payload.author_email = email || payload.author_email;
      applyJournalistEditorialRouting(payload);
    } else {
      const ec = normalizeEditorialCategory(payload.editorial_category);
      payload.editorial_category = ec;
    }

    const supabase = getServiceSupabase();
    if (!supabase) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

    const providedSlug =
      typeof payload.slug === 'string' && payload.slug.trim() ? payload.slug.trim() : '';

    let baseSlug =
      providedSlug || slugBase(String(payload.title || 'article'));

    let slug =
      providedSlug || `${slugBase(String(payload.title || 'article'))}-${uniqueSlugPart()}`;
    payload.slug = slug;

    delete payload.id;

    const maxAttempts = 6;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { data: row, error } = await supabase
        .from('articles')
        .insert(payload as Record<string, unknown>)
        .select('id, slug')
        .maybeSingle();

      if (!error && row?.id) {
        const bodyPayload = incoming as Record<string, unknown>;

        if (bodyPayload.status === 'published') {
          await triggerRevalidate(req, row.slug);
          await sendEmail(
            'editorial@groundviewnews.com',
            `New Article Published: ${String(bodyPayload.title || '')}`,
            `<p><strong>Title:</strong> ${bodyPayload.title}</p>
<p><strong>Category:</strong> ${bodyPayload.category || 'N/A'}</p>
<p><strong>Author:</strong> ${bodyPayload.author_name || 'N/A'}</p>
<p><strong>Link:</strong> <a href="https://groundviewnews.com/article/${row.slug}">https://groundviewnews.com/article/${row.slug}</a></p>`
          );
        }

        return NextResponse.json({ ok: true, id: row.id, slug: row.slug });
      }

      console.error('[articles POST] insert attempt failed:', error?.message, error?.code);
      const isDup =
        error?.code === '23505' ||
        (typeof error?.message === 'string' &&
          error.message.toLowerCase().includes('duplicate') &&
          error.message.toLowerCase().includes('slug'));

      if (isDup) {
        slug = `${baseSlug}-${uniqueSlugPart()}`;
        payload.slug = slug;
        continue;
      }

      return NextResponse.json({ error: error?.message || 'Insert failed.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Could not allocate a unique slug.' }, { status: 409 });
  } catch (e) {
    console.error('[articles POST]', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await resolveArticlesActor(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { id, ...payload } = body as { id?: string } & Record<string, unknown>;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServiceSupabase();
    if (!supabase) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

    if (actor.kind === 'journalist') {
      const { data: existing, error: fetchErr } = await supabase
        .from('articles')
        .select('author_id, editorial_category')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 400 });
      if (!existing?.author_id || existing.author_id !== actor.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      payload.author_id = actor.user.id;
      if (actor.user.email) payload.author_email = actor.user.email;
      if (payload.editorial_category === undefined || payload.editorial_category === null) {
        payload.editorial_category = (existing as { editorial_category?: string }).editorial_category ?? 'general';
      }
      applyJournalistEditorialRouting(payload as Record<string, unknown>);
    } else {
      const ec = normalizeEditorialCategory((payload as Record<string, unknown>).editorial_category);
      (payload as Record<string, unknown>).editorial_category = ec;
    }

    const { error } = await supabase.from('articles').update(payload).eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const p = payload as Record<string, unknown>;
    const slug =
      typeof p.slug === 'string' && p.slug ? p.slug : undefined;

    if (p.status === 'published') {
      await triggerRevalidate(req, slug);
      await sendEmail(
        'editorial@groundviewnews.com',
        `New Article Published: ${String(p.title || '')}`,
        `<p><strong>Title:</strong> ${p.title}</p>
<p><strong>Category:</strong> ${p.category || 'N/A'}</p>
<p><strong>Author:</strong> ${p.author_name || 'N/A'}</p>
<p><strong>Link:</strong> <a href="https://groundviewnews.com/article/${slug}">https://groundviewnews.com/article/${slug}</a></p>`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[articles PATCH]', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await resolveArticlesActor(req);
    if (actor?.kind !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServiceSupabase();
    if (!supabase) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    const { error } = await supabase.from('articles').delete().eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[articles DELETE]', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
