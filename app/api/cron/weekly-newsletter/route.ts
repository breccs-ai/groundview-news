import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import {
  DIGEST_SUBJECT,
  NEWSLETTER_FROM,
  unsubscribeHeaders,
  weeklyDigestHtml,
  type DigestArticle,
} from '@/lib/newsletter-emails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Weekly digest, sent every Monday 08:00 UTC (see vercel.json).
 *
 * Recipients: confirmed free subscribers plus active paid members, de-duplicated by
 * lowercased address, minus everyone on the suppression list. Each email carries that
 * person's own signed unsubscribe link and a one-click List-Unsubscribe header.
 *
 * This used to call a Supabase Edge Function that linked to a page that does not
 * exist and ignored the suppression list. Sending from here keeps the unsubscribe
 * and suppression logic in one place, deployed with the rest of the site.
 *
 * Auth: Bearer CRON_SECRET, as for the other cron routes. Add ?dry_run=1 to see the
 * recipient count without sending anything.
 */

type Row = { email?: string | null };
type Page = PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;

// Reads every row, a page at a time, so the lists are not silently cut at 1000.
async function fetchAll(label: string, page: (from: number, to: number) => Page): Promise<Row[]> {
  const rows: Row[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const dryRun = req.nextUrl.searchParams.get('dry_run') === '1';

  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Top 5 published articles in the last 7 days, most viewed first.
    const { data: articleData, error: artErr } = await supabase
      .from('articles')
      .select('title, slug, category, excerpt, views')
      .eq('status', 'published')
      .gte('published_at', weekAgo)
      .order('views', { ascending: false, nullsFirst: false })
      .limit(5);
    if (artErr) throw new Error(`articles: ${artErr.message}`);
    const articles = (articleData || []) as DigestArticle[];
    if (articles.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: 'no articles in window' });
    }

    const [free, paid, suppressed] = await Promise.all([
      fetchAll('subscribers', (f, t) => supabase.from('subscribers').select('email').eq('confirmed', true).range(f, t)),
      fetchAll('profiles', (f, t) => supabase.from('profiles').select('email').eq('subscription_status', 'active').range(f, t)),
      fetchAll('email_suppressions', (f, t) => supabase.from('email_suppressions').select('email').range(f, t)),
    ]);

    const norm = (e?: string | null) => (e || '').trim().toLowerCase();
    const blocked = new Set(suppressed.map((r) => norm(r.email)).filter(Boolean));
    const recipients = new Set<string>();
    for (const r of [...free, ...paid]) {
      const e = norm(r.email);
      if (e && !blocked.has(e)) recipients.add(e);
    }
    const skippedSuppressed = new Set([...free, ...paid].map((r) => norm(r.email)).filter((e) => e && blocked.has(e))).size;

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dry_run: true,
        articles: articles.length,
        recipients_total: recipients.size,
        skipped_suppressed: skippedSuppressed,
      });
    }

    let sent = 0;
    let failed = 0;
    for (const to of Array.from(recipients)) {
      const ok = await sendEmail(to, DIGEST_SUBJECT, weeklyDigestHtml(articles, to), NEWSLETTER_FROM, unsubscribeHeaders(to));
      if (ok) sent++;
      else failed++;
    }

    return NextResponse.json({
      ok: true,
      date: new Date().toISOString(),
      articles: articles.length,
      sent,
      failed,
      recipients_total: recipients.size,
      skipped_suppressed: skippedSuppressed,
    });
  } catch (e) {
    console.error('[cron/weekly-newsletter]', e);
    return NextResponse.json({ error: 'Newsletter run failed' }, { status: 500 });
  }
}
