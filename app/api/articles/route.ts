import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { resolveArticlesActor } from '@/lib/articles-api-auth';
import { normalizeEditorialCategory, requiresHumanEditorialReview } from '@/lib/editorial-category';
import { generateSlug, generateUniqueSlug } from '@/lib/slug';

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

/** PATCH submit-for-review: route status by editorial_category before DB write. */
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

/** Same bypass list as journalist POST — kept for PATCH parity with POST ordering logic. */
const EDITORIAL_BYPASS_CATEGORIES = [
  'human-rights-reporting',
  'conflict-reporting',
  'political-commentary',
] as const;

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

      // STEP 1 — Resolve editorial_category from the request body first (before any moderation-related routing).
      const editorialCategory = normalizeEditorialCategory(payload.editorial_category);
      payload.editorial_category = editorialCategory;

      // STEP 2 — Bypass list check BEFORE any automated moderation runs later in the pipeline.
      const bypassModeration = (EDITORIAL_BYPASS_CATEGORIES as readonly string[]).includes(editorialCategory);

      const submitStatuses = ['pending', 'pending_editorial'];
      const statusStr = payload.status;
      const isSubmitForReview =
        typeof statusStr === 'string' && submitStatuses.includes(statusStr);

      // STEP 3–4 — Set initial article status from editorial category before moderation:
      // If bypass: human editorial queue only (never send through automated moderation in review).
      // If not bypass: pending → existing automated moderation runs in POST /api/articles/review after insert.
      if (isSubmitForReview) {
        if (bypassModeration) {
          payload.status = 'pending_editorial';
        } else {
          payload.status = 'pending';
        }
      }

      const email =
        actor.user.email && typeof actor.user.email === 'string' ? actor.user.email : '';
      payload.author_email = email || payload.author_email;
      // STEP 5 — featured_image_url: supplied by client on payload (no server-side image generation in this handler).
      // STEP 6 — insert block below runs after status + editorial_category are finalized above.
    } else {
      const ec = normalizeEditorialCategory(payload.editorial_category);
      payload.editorial_category = ec;
    }

    const supabase = getServiceSupabase();
    if (!supabase) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

    const title = String(payload.title || '').trim();
    const baseSlug = generateSlug(title) || 'article';
    let slug = baseSlug;
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

        if (payload.status === 'published') {
          await triggerRevalidate(req, row.slug);
          await sendEmail(
            'info@groundviewnews.com',
            `New Article Published: ${String(bodyPayload.title || '')}`,
            `<p><strong>Title:</strong> ${bodyPayload.title}</p>
<p><strong>Category:</strong> ${bodyPayload.category || 'N/A'}</p>
<p><strong>Author:</strong> ${bodyPayload.author_name || 'N/A'}</p>
<p><strong>Link:</strong> <a href="https://groundviewnews.com/articles/${row.slug}">https://groundviewnews.com/articles/${row.slug}</a></p>`
          );
        }

        // STEP 7 — Response after successful Supabase insert.
        const statusOut = typeof payload.status === 'string' ? payload.status : undefined;
        return NextResponse.json({ ok: true, id: row.id, slug: row.slug, status: statusOut });
      }

      console.error('[articles POST] insert attempt failed:', error?.message, error?.code);
      const isDup =
        error?.code === '23505' ||
        (typeof error?.message === 'string' &&
          error.message.toLowerCase().includes('duplicate') &&
          error.message.toLowerCase().includes('slug'));

      if (isDup) {
        slug = generateUniqueSlug(title);
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

    console.log('[articles PATCH] incoming body:', JSON.stringify(body));

    const { id, ...payload } = body as { id?: string } & Record<string, unknown>;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const p = payload as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(p, 'label')) {
      const v = p.label;
      if (v === '' || v === undefined || v === null) {
        p.label = 'Commentary';
      }
    }
    if (Object.prototype.hasOwnProperty.call(p, 'category')) {
      const v = p.category;
      if (v === '' || v === undefined || v === null) {
        p.category = 'commentary';
      }
    }

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

    const slug =
      typeof p.slug === 'string' && p.slug ? p.slug : undefined;

    if (p.status === 'published') {
      await triggerRevalidate(req, slug);
      await sendEmail(
        'info@groundviewnews.com',
        `New Article Published: ${String(p.title || '')}`,
        `<p><strong>Title:</strong> ${p.title}</p>
<p><strong>Category:</strong> ${p.category || 'N/A'}</p>
<p><strong>Author:</strong> ${p.author_name || 'N/A'}</p>
<p><strong>Link:</strong> <a href="https://groundviewnews.com/articles/${slug}">https://groundviewnews.com/articles/${slug}</a></p>`
      );
    }

    const statusOut = typeof payload.status === 'string' ? payload.status : undefined;
    return NextResponse.json({ ok: true, status: statusOut });
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
