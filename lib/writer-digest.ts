import { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { WRITER_EMAIL_FROM, articleDigestEmail, type DigestArticle } from '@/lib/writer-emails';
import { fetchActiveWriters } from '@/lib/active-writers';
import { articleCanonicalUrl } from '@/lib/article-public-url';

export type DigestSourceArticle = {
  title: string;
  slug: string;
  author_id: string | null;
  author_name: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Emails every active writer the given articles, minus whichever of those
 * articles they authored themselves — nobody gets told to go share their own
 * piece. Used by both the recurring Monday digest and the one-off "latest
 * story" send; `periodLabel` is the only thing that differs between them.
 */
export async function sendArticleDigest(
  supabase: SupabaseClient,
  articles: DigestSourceArticle[],
  periodLabel: string
): Promise<{ sent: number; skipped: number; failed: string[] }> {
  if (articles.length === 0) return { sent: 0, skipped: 0, failed: [] };

  const writers = await fetchActiveWriters(supabase);
  let sent = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const writer of writers) {
    const forThisWriter: DigestArticle[] = articles
      .filter((a) => a.author_id !== writer.id)
      .map((a) => ({
        title: a.title,
        url: articleCanonicalUrl(a.slug),
        authorName: a.author_name || 'Ground View News',
      }));

    if (forThisWriter.length === 0) {
      skipped += 1;
      continue;
    }

    const tmpl = articleDigestEmail({
      id: writer.id,
      fullName: writer.full_name || '',
      periodLabel,
      articles: forThisWriter,
    });
    const ok = await sendEmail(writer.email, tmpl.subject, tmpl.html, WRITER_EMAIL_FROM, tmpl.headers);
    if (ok) sent += 1;
    else failed.push(writer.email);
    await sleep(200);
  }

  return { sent, skipped, failed };
}
