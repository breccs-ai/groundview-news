import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function bearerToken(req: NextRequest): string | null {
  const h = req.headers.get('authorization');
  if (!h || !h.toLowerCase().startsWith('bearer ')) return null;
  return h.slice(7).trim() || null;
}

type ProfileRoles = {
  roles?: string[] | null;
  role?: string | null;
};

function hasAdvertiserRole(profile: ProfileRoles | null): boolean {
  return Boolean(
    (profile?.roles && profile.roles.includes('advertiser')) || profile?.role === 'advertiser'
  );
}

const ALLOWED_STATUS = new Set(['draft', 'pending', 'pending_review']);

export async function POST(req: NextRequest) {
  try {
    const token = bearerToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = getServiceSupabase();
    if (!service) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const {
      data: { user },
      error: authErr,
    } = await service.auth.getUser(token);

    if (authErr || !user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profErr } = await service
      .from('profiles')
      .select('role, roles')
      .eq('id', user.id)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 400 });
    }

    if (!hasAdvertiserRole(profile as ProfileRoles | null)) {
      return NextResponse.json({ error: 'Advertiser access required' }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const adId = typeof body.ad_id === 'string' && body.ad_id.trim() ? body.ad_id.trim() : null;

    const company_name = typeof body.company_name === 'string' ? body.company_name : '';
    const title = typeof body.title === 'string' ? body.title : '';
    const copy = typeof body.copy === 'string' ? body.copy : '';
    const destination_url = typeof body.destination_url === 'string' ? body.destination_url : '';
    const image_url = typeof body.image_url === 'string' ? body.image_url : '';
    const video_url = typeof body.video_url === 'string' ? body.video_url : '';
    const package_days = Number(body.package_days);
    const package_price_pence = Number(body.package_price_pence);
    const status = typeof body.status === 'string' ? body.status : 'draft';

    if (!Number.isFinite(package_days) || package_days < 1) {
      return NextResponse.json({ error: 'Invalid package_days' }, { status: 400 });
    }
    if (!Number.isFinite(package_price_pence) || package_price_pence < 0) {
      return NextResponse.json({ error: 'Invalid package_price_pence' }, { status: 400 });
    }
    if (!ALLOWED_STATUS.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const row = {
      user_id: user.id,
      company_name,
      title,
      copy,
      destination_url,
      image_url: image_url || null,
      video_url: video_url || null,
      package_days: Math.floor(package_days),
      package_price_pence: Math.floor(package_price_pence),
      status,
      updated_at: new Date().toISOString(),
    };

    if (adId) {
      const { data: existing, error: exErr } = await service
        .from('advertisements')
        .select('user_id')
        .eq('id', adId)
        .maybeSingle();

      if (exErr) {
        return NextResponse.json({ error: exErr.message }, { status: 400 });
      }
      const owner = existing as { user_id?: string } | null;
      if (!owner || owner.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { data: updated, error: upErr } = await service
        .from('advertisements')
        .update(row)
        .eq('id', adId)
        .select('id')
        .single();

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, ad_id: (updated as { id: string }).id });
    }

    const { data: inserted, error: insErr } = await service
      .from('advertisements')
      .insert(row)
      .select('id')
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, ad_id: (inserted as { id: string }).id });
  } catch (e) {
    console.error('[advertiser/save-ad]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
