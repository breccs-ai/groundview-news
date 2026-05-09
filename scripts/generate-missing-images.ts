/**
 * One-time backfill: generate featured images for published articles with no image URL.
 *
 * Env (same as app): OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_SITE_URL (your deployed site root, no trailing slash),
 * ARTICLE_IMAGE_BATCH_SECRET (must match the API route env `ARTICLE_IMAGE_BATCH_SECRET`).
 *
 * Run from repo root:
 *   npx tsx scripts/generate-missing-images.ts
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(
  /\/$/,
  ''
);
const batchSecret = process.env.ARTICLE_IMAGE_BATCH_SECRET;

async function main() {
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!batchSecret) {
    console.error('Missing ARTICLE_IMAGE_BATCH_SECRET');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id,title,excerpt,category,featured_image_url')
    .eq('status', 'published');

  if (error) {
    console.error('Fetch failed:', error.message);
    process.exit(1);
  }

  const rows = (articles || []).filter((a) => !a.featured_image_url?.trim());

  console.log(`Found ${rows.length} published article(s) without a featured image.`);

  for (const article of rows) {
    const title = String(article.title || '').trim();
    if (!title) {
      console.warn('Skipping article with empty title:', article.id);
      continue;
    }

    let res: Response;
    try {
      res = await fetch(`${siteUrl}/api/articles/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-article-image-batch': batchSecret,
        },
        body: JSON.stringify({
          title,
          excerpt: String(article.excerpt || ''),
          category: String(article.category || 'commentary'),
        }),
      });
    } catch (e) {
      console.error('Request failed:', title, e);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    const json = (await res.json().catch(() => ({}))) as { imageUrl?: string; error?: string };
    if (!res.ok || !json.imageUrl) {
      console.error('Generation failed:', title, json.error || res.status);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    const { error: upErr } = await supabase
      .from('articles')
      .update({ featured_image_url: json.imageUrl })
      .eq('id', article.id);

    if (upErr) {
      console.error('DB update failed:', article.id, upErr.message);
    } else {
      console.log(`Generated image for: ${title}`);
    }

    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
