import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { resolveArticlesActor } from '@/lib/articles-api-auth';
import { generateSlug } from '@/lib/slug';

export const runtime = 'nodejs';

function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function ensureBucket(supabase: SupabaseClient) {
  const { error } = await supabase.storage.createBucket('article-images', {
    public: true,
  });
  if (error && !/already exists|duplicate/i.test(String(error.message))) {
    console.warn('[generate-image] createBucket:', error.message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const batchSecret = process.env.ARTICLE_IMAGE_BATCH_SECRET;
    const batchHeader = req.headers.get('x-article-image-batch');
    const batchOk = Boolean(batchSecret && batchHeader === batchSecret);

    if (!batchOk) {
      const actor = await resolveArticlesActor(req);
      if (!actor) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const excerpt = typeof body.excerpt === 'string' ? body.excerpt.trim() : '';
    const category =
      typeof body.category === 'string' && body.category.trim()
        ? body.category.trim()
        : 'commentary';

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    console.log('[generate-image]', { title: title.slice(0, 120), category });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[generate-image] Missing OPENAI_API_KEY');
      return NextResponse.json({ error: 'Image generation unavailable' }, { status: 500 });
    }

    const supabase = getServiceSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    await ensureBucket(supabase);

    const prompt = `Editorial photography style, photojournalism, professional news publication image representing: ${title}. ${excerpt}. No text, no words, no letters in the image. Cinematic lighting, high quality, documentary style photograph.`;

    const openai = new OpenAI({ apiKey });

    let imageResponse;
    try {
      imageResponse = await openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1792x1024',
        quality: 'standard',
        style: 'natural',
      });
    } catch (e) {
      console.error('[generate-image] OpenAI error:', e);
      return NextResponse.json({ error: 'Image generation failed' }, { status: 502 });
    }

    const tempUrl = imageResponse.data?.[0]?.url;
    if (!tempUrl) {
      console.error('[generate-image] No image URL in OpenAI response');
      return NextResponse.json({ error: 'Image generation failed' }, { status: 502 });
    }

    let downloadRes: Response;
    try {
      downloadRes = await fetch(tempUrl);
    } catch (e) {
      console.error('[generate-image] Download fetch error:', e);
      return NextResponse.json({ error: 'Image generation failed' }, { status: 502 });
    }

    if (!downloadRes.ok) {
      console.error('[generate-image] Download failed', downloadRes.status);
      return NextResponse.json({ error: 'Image generation failed' }, { status: 502 });
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = downloadRes.headers.get('content-type') || 'image/png';
    const ext =
      contentType.includes('jpeg') || contentType.includes('jpg')
        ? '.jpg'
        : contentType.includes('webp')
          ? '.webp'
          : '.png';

    const baseSlug = generateSlug(title) || 'article';
    const objectPath = `articles/${baseSlug}-${Date.now()}${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('article-images')
      .upload(objectPath, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadErr) {
      console.error('[generate-image] Storage upload:', uploadErr.message);
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from('article-images').getPublicUrl(objectPath);

    return NextResponse.json({ imageUrl: pub.publicUrl });
  } catch (e) {
    console.error('[generate-image]', e);
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
  }
}
