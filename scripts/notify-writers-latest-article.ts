/**
 * One-off announcement: tells every other active writer about the most
 * recently published article, encouraging them to share it. Not wired into
 * any route — run manually. The recurring version of this (all of last
 * week's articles, every Monday) is app/api/cron/weekly-writer-digest.
 *
 * Dry run (default, sends nothing):
 *   npx tsx scripts/notify-writers-latest-article.ts
 *
 * Actually send:
 *   npx tsx scripts/notify-writers-latest-article.ts --send
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * RESEND_API_KEY (loads .env.local the same way `next dev` does).
 */
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { createClient } from '@supabase/supabase-js';
import { sendArticleDigest } from '@/lib/writer-digest';

async function main() {
  const send = process.argv.includes('--send');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  if (send && !process.env.RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY — required to actually send (omit --send for a dry run).');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('articles')
    .select('title, slug, author_id, author_name')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  const article = (data || [])[0];
  if (!article) {
    console.log('No published articles found.');
    return;
  }

  console.log(`Latest article: "${article.title}" by ${article.author_name || 'Unknown'}`);

  if (!send) {
    console.log('\nDry run only — nothing was sent. Re-run with --send to actually email other writers.');
    return;
  }

  const result = await sendArticleDigest(supabase, [article], 'Latest story');
  console.log(`\nDone. Sent ${result.sent}, skipped ${result.skipped} (own article), ${result.failed.length} failed.`);
  if (result.failed.length) {
    console.error(`Failed: ${result.failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main();
