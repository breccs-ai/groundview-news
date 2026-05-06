import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function PUT(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const adId = formData.get('adId') as string | null;

  if (!file || !adId) {
    return NextResponse.json({ error: 'Missing file or adId' }, { status: 400 });
  }

  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    return NextResponse.json({ error: 'Only JPG and PNG images accepted' }, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image exceeds 2MB limit' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `ads/${adId}.${ext}`;

  const supabase = getSupabase();
  const { error } = await supabase.storage
    .from('ad-images')
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data } = supabase.storage.from('ad-images').getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
