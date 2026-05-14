import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';

export const runtime = 'nodejs';

function bearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization');
  if (!h?.toLowerCase().startsWith('bearer ')) return null;
  return h.slice(7).trim() || null;
}

export async function PUT(req: NextRequest) {
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = getServiceSupabase();
  if (!service) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const {
    data: { user },
    error: authErr,
  } = await service.auth.getUser(token);
  if (authErr || !user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const adId = formData.get('adId') as string | null;

  if (!file || !adId) {
    return NextResponse.json({ error: 'Missing file or adId' }, { status: 400 });
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return NextResponse.json({ error: 'Only JPG, PNG, or WebP images accepted' }, { status: 400 });
  }

  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image exceeds 4MB limit' }, { status: 400 });
  }

  const { data: ad } = await service.from('advertisements').select('advertiser_id').eq('id', adId).maybeSingle();
  const row = ad as { advertiser_id?: string } | null;
  if (!row?.advertiser_id) return NextResponse.json({ error: 'Ad not found' }, { status: 404 });

  const { data: prof } = await service.from('advertiser_profiles').select('user_id').eq('id', row.advertiser_id).maybeSingle();
  const p = prof as { user_id?: string } | null;
  if (!p || p.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `ads/${adId}.${ext}`;
  const bucket = 'ad-assets';

  let { error: upErr } = await service.storage.from(bucket).upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });

  if (upErr) {
    await service.storage.createBucket(bucket, { public: true }).catch(() => {});
    const second = await service.storage.from(bucket).upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });
    upErr = second.error;
  }

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  const { data } = service.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
