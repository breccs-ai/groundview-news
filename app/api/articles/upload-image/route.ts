import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { resolveArticlesActor } from '@/lib/articles-api-auth';
import { generateSlug } from '@/lib/slug';
import {
  ARTICLE_IMAGE_ALLOWED_TYPES,
  ARTICLE_IMAGE_BUCKET,
  ARTICLE_IMAGE_UPLOAD_MAX_BYTES,
  type ArticleImageContentType,
} from '@/lib/article-image-constraints';

export const runtime = 'nodejs';

function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function ensureBucket(supabase: SupabaseClient) {
  const { error } = await supabase.storage.createBucket(ARTICLE_IMAGE_BUCKET, {
    public: true,
  });
  if (error && !/already exists|duplicate/i.test(String(error.message))) {
    console.warn('[upload-image] createBucket:', error.message);
  }
}

function hasBytes(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function asciiAt(bytes: Uint8Array, start: number, length: number) {
  let out = '';
  for (let i = start; i < start + length && i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function detectImageType(bytes: Uint8Array): ArticleImageContentType | null {
  if (hasBytes(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  const isWebp =
    bytes.length >= 12 &&
    asciiAt(bytes, 0, 4) === 'RIFF' &&
    asciiAt(bytes, 8, 4) === 'WEBP';
  if (isWebp) return 'image/webp';
  return null;
}

function extensionForType(type: ArticleImageContentType) {
  if (type === 'image/jpeg') return '.jpg';
  if (type === 'image/png') return '.png';
  return '.webp';
}

export async function POST(req: NextRequest) {
  try {
    const actor = await resolveArticlesActor(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const formData = await req.formData().catch(() => null);
    const file = formData?.get('file');
    const title = String(formData?.get('title') || '').trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Image file is required.' }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'Image file is empty.' }, { status: 400 });
    }

    if (file.size > ARTICLE_IMAGE_UPLOAD_MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be 5MB or smaller.' }, { status: 413 });
    }

    if (!ARTICLE_IMAGE_ALLOWED_TYPES.includes(file.type as ArticleImageContentType)) {
      return NextResponse.json(
        { error: 'Unsupported image type. Upload JPEG, PNG, or WebP only.' },
        { status: 415 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const detectedType = detectImageType(bytes);

    if (!detectedType || detectedType !== file.type) {
      return NextResponse.json(
        { error: 'Invalid image file. The file contents do not match its type.' },
        { status: 415 }
      );
    }

    await ensureBucket(supabase);

    const owner = actor.kind === 'journalist' ? actor.user.id : 'admin';
    const baseSlug = generateSlug(title) || generateSlug(file.name) || 'article-image';
    const objectPath = `articles/uploads/${owner}/${baseSlug}-${Date.now()}${extensionForType(
      detectedType
    )}`;

    const { error: uploadErr } = await supabase.storage
      .from(ARTICLE_IMAGE_BUCKET)
      .upload(objectPath, Buffer.from(arrayBuffer), {
        contentType: detectedType,
        upsert: false,
      });

    if (uploadErr) {
      console.error('[upload-image] Storage upload:', uploadErr.message);
      return NextResponse.json({ error: 'Image upload failed.' }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from(ARTICLE_IMAGE_BUCKET).getPublicUrl(objectPath);

    return NextResponse.json({ imageUrl: pub.publicUrl });
  } catch (e) {
    console.error('[upload-image]', e);
    return NextResponse.json({ error: 'Image upload failed.' }, { status: 500 });
  }
}
