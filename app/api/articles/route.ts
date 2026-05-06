import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_COOKIE = 'gvn_admin_session';
const ADMIN_COOKIE_VALUE = 'authenticated';

function isAdmin(req: NextRequest): boolean {
  const cookie = req.cookies.get(ADMIN_COOKIE);
  return cookie?.value === ADMIN_COOKIE_VALUE;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function triggerRevalidate(req: NextRequest, slug?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  await fetch(`${baseUrl}/api/revalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  }).catch(() => {});
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const supabase = getSupabase();
  const { error } = await supabase.from('articles').insert(body);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (body.status === 'published') {
    await triggerRevalidate(req, body.slug);
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, ...payload } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = getSupabase();
  const { error } = await supabase.from('articles').update(payload).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (payload.status === 'published') {
    await triggerRevalidate(req, payload.slug);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = getSupabase();
  const { error } = await supabase.from('articles').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
