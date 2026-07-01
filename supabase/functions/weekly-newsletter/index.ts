/**
 * Supabase Edge Function: weekly-newsletter
 *
 * Builds and sends the Ground View News weekly digest:
 *   - Recipients: active paid subscribers from `profiles`, plus confirmed
 *     free subscribers from `subscribers`. De-duplicated by lowercased email.
 *   - Content   : the 5 most-viewed articles over the past 7 days, by
 *     `articles.views` joined against published status.
 *   - Subject   : "Ground View News — This Week's Top Stories"
 *   - Sender    : info@groundviewnews.com
 *   - Signature : "The Editor, Continental View | Ground View News"
 *
 * Triggered by /api/cron/weekly-newsletter every Monday at 08:00 UTC.
 * Authenticated via the `x-cron-secret` request header (matched against
 * CRON_SECRET) so the function can also be invoked from a Vercel cron route.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const SITE = 'https://groundviewnews.com';
const FROM = 'Ground View News <info@groundviewnews.com>';
const SUBJECT = "Ground View News — This Week's Top Stories";
const SIGNATURE = 'The Editor, Continental View | Ground View News';

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  views: number | null;
  published_at: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function articleCardHtml(a: ArticleRow): string {
  const title = escapeHtml(a.title || 'Untitled');
  const category = a.category ? escapeHtml(a.category) : '';
  const excerpt = a.excerpt ? escapeHtml(a.excerpt) : '';
  const href = `${SITE}/articles/${encodeURIComponent(a.slug)}`;
  return `
<tr><td style="padding:18px 0;border-bottom:1px solid #eee;">
  ${category ? `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#b8860b;margin-bottom:6px;">${category}</div>` : ''}
  <a href="${href}" style="color:#0f1f3d;text-decoration:none;font-family:Georgia,serif;font-size:18px;font-weight:700;line-height:1.3;display:block;margin-bottom:6px;">${title}</a>
  ${excerpt ? `<p style="margin:0 0 8px 0;color:#444;font-family:Georgia,serif;font-size:14px;line-height:1.6;">${excerpt}</p>` : ''}
  <a href="${href}" style="color:#b8860b;text-decoration:none;font-size:13px;font-weight:600;">Read more →</a>
</td></tr>`;
}

function buildEmailHtml(articles: ArticleRow[]): string {
  const cards = articles.map(articleCardHtml).join('\n');
  return `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f7f7f7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f7;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#fff;max-width:600px;margin:30px auto;">
        <tr><td style="padding:28px 28px 8px 28px;">
          <div style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:700;color:#0f1f3d;">
            Ground View <span style="color:#d4a017;">News</span>
          </div>
          <div style="font-family:Inter,Arial,sans-serif;font-size:12px;color:#666;margin-top:4px;letter-spacing:0.04em;text-transform:uppercase;">This week's top stories</div>
        </td></tr>
        <tr><td style="padding:8px 28px 0 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            ${cards}
          </table>
        </td></tr>
        <tr><td style="padding:28px;border-top:1px solid #eee;">
          <p style="margin:0 0 6px 0;font-family:Inter,Arial,sans-serif;font-size:13px;color:#333;">${escapeHtml(SIGNATURE)}</p>
          <p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:11px;color:#999;">
            You're receiving this email because you subscribed at <a href="${SITE}" style="color:#999;">groundviewnews.com</a>.
            <a href="${SITE}/unsubscribe" style="color:#999;">Unsubscribe</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendResend(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) {
    console.warn('RESEND_API_KEY missing');
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text().catch(() => ''));
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Auth: shared CRON_SECRET, accepted via `x-cron-secret` header or
  // `Authorization: Bearer <secret>` so the function works from either a
  // Supabase scheduled invocation or a Vercel cron route.
  const expected = Deno.env.get('CRON_SECRET');
  const headerSecret =
    req.headers.get('x-cron-secret') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (expected && headerSecret !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env' }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Top 5 published articles in the last 7 days, ordered by view count.
  const { data: articleData, error: artErr } = await supabase
    .from('articles')
    .select('id, title, slug, category, excerpt, views, published_at')
    .eq('status', 'published')
    .gte('published_at', weekAgo)
    .order('views', { ascending: false, nullsFirst: false })
    .limit(5);

  if (artErr) {
    return new Response(JSON.stringify({ error: artErr.message }), { status: 500 });
  }
  const articles = (articleData || []) as ArticleRow[];

  if (articles.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no articles in window' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Recipients: union of confirmed free newsletter subs + active paid subs.
  const [{ data: freeRows }, { data: paidRows }] = await Promise.all([
    supabase.from('subscribers').select('email').eq('confirmed', true),
    supabase.from('profiles').select('email').eq('subscription_status', 'active'),
  ]);

  const recipients = new Set<string>();
  for (const r of freeRows || []) {
    const e = (r as { email?: string }).email;
    if (e) recipients.add(e.trim().toLowerCase());
  }
  for (const r of paidRows || []) {
    const e = (r as { email?: string }).email;
    if (e) recipients.add(e.trim().toLowerCase());
  }

  const html = buildEmailHtml(articles);

  let sent = 0;
  let failed = 0;
  for (const to of Array.from(recipients)) {
    const ok = await sendResend(to, SUBJECT, html);
    if (ok) sent++;
    else failed++;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      date: now.toISOString(),
      articles: articles.length,
      sent,
      failed,
      recipients_total: recipients.size,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
