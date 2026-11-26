// Data integrity and operational health. Reads production data with the
// service-role key from .env.local; it never modifies real records.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { suite, test, finding, assert } from '../framework.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..');
const { createLoader } = require('../ts-loader.cjs');
const BASE = (process.env.BASE_URL || 'https://groundviewnews.com').replace(/\/$/, '');
const DAY = 86400000;
const age = (iso) => Math.round((Date.now() - Date.parse(iso)) / DAY);

export default async function run() {
  suite('Data integrity & operations');
  let env;
  try { env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8'); } catch { env = ''; }
  const url = (env.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/) || [])[1];
  const key = (env.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/) || [])[1];
  if (!url || !key) { finding('info', 'Data suite skipped', 'no Supabase credentials in .env.local'); return; }
  const { createClient } = require(path.join(ROOT, 'node_modules', '@supabase', 'supabase-js'));
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const load = createLoader();
  const adminAuth = load('@/lib/admin-auth');
  const editorial = load('@/lib/editorial-category');

  const { data: articles } = await sb.from('articles').select('id,title,slug,status,category,label,editorial_category,excerpt,subtitle,body,author_id,author_email,author_name,featured_image_url,article_images,published_at,created_at,updated_at,views,shares');
  const published = articles.filter((a) => a.status === 'published');
  const md = (a) => (a.body && typeof a.body === 'object' && a.body.markdown) || '';
  finding('info', 'Articles', `${articles.length} total, ${published.length} published, ${articles.length - published.length} not published`);

  // ---------- Articles
  await test('every published article has a publish date (regression: null dates once sorted first on the homepage)', () => {
    const bad = published.filter((a) => !a.published_at).map((a) => a.slug);
    assert(bad.length === 0, bad.join(', '));
  });
  await test('articles have a title, a slug in a-z0-9- form, and slugs are unique', () => {
    const bad = articles.filter((a) => !a.title?.trim() || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug || '')).map((a) => a.slug || a.id);
    assert(bad.length === 0, 'bad: ' + bad.join(', '));
    const seen = new Set(); const dup = [];
    for (const a of articles) { if (seen.has(a.slug)) dup.push(a.slug); seen.add(a.slug); }
    assert(dup.length === 0, 'duplicate slugs: ' + dup.join(', '));
  });
  await test('categories, labels, editorial categories and statuses are all valid values', () => {
    const cats = new Set(adminAuth.ARTICLE_CATEGORY_SLUGS), labels = new Set(adminAuth.LABEL_OPTIONS), eds = new Set(editorial.EDITORIAL_CATEGORY_VALUES);
    const statuses = new Set(['draft', 'pending', 'pending_editorial', 'approved_pending_publish', 'published', 'rejected', 'quarantined']);
    const bad = articles.filter((a) => !cats.has(a.category) || !labels.has(a.label) || !eds.has(a.editorial_category) || !statuses.has(a.status)).map((a) => `${a.slug.slice(0, 30)}[${a.category}/${a.label}/${a.editorial_category}/${a.status}]`);
    assert(bad.length === 0, bad.join(' | '));
  });
  await test('every published article has body text', () => {
    const bad = published.filter((a) => md(a).trim().length < 200).map((a) => a.slug.slice(0, 40));
    assert(bad.length === 0, bad.join(', '));
  });
  await test('article counters are not negative', () => {
    const bad = articles.filter((a) => (a.views ?? 0) < 0).map((a) => a.slug);
    assert(bad.length === 0, bad.join(', '));
  });
  await test('every article\'s writer account exists (no orphaned author_id)', async () => {
    const { data: profs } = await sb.from('profiles').select('id');
    const ids = new Set(profs.map((p) => p.id));
    const orphans = articles.filter((a) => a.author_id && !ids.has(a.author_id)).map((a) => a.slug.slice(0, 40));
    assert(orphans.length === 0, orphans.join(', '));
  });
  await test('published article images all come from a host the site is configured to display', () => {
    const nextCfg = fs.readFileSync(path.join(ROOT, 'next.config.js'), 'utf8');
    const host = (nextCfg.match(/hostname:\s*'([^']+)'/) || [])[1];
    const bad = [];
    for (const a of published) {
      const urls = [a.featured_image_url, ...((Array.isArray(a.article_images) ? a.article_images : []).map((i) => (typeof i === 'string' ? i : i && i.url)))].filter(Boolean);
      for (const u of urls) { try { if (new URL(u).hostname !== host) bad.push(a.slug.slice(0, 30) + ' -> ' + new URL(u).hostname); } catch { bad.push(a.slug.slice(0, 30) + ' invalid url'); } }
    }
    assert(bad.length === 0, bad.join(' | '));
  });
  await test('articles that are not published are not reachable on the live site', async () => {
    const hidden = articles.filter((a) => a.status !== 'published');
    const leaked = [];
    for (const a of hidden) { const r = await fetch(`${BASE}/articles/${a.slug}`); if (r.status !== 404) leaked.push(`${a.slug.slice(0, 40)} (${a.status}) -> ${r.status}`); }
    assert(leaked.length === 0, leaked.join(' | '));
    return hidden.length + ' unpublished articles checked';
  });
  await test('published articles have an excerpt or subtitle (used for search and share descriptions)', () => {
    const bad = published.filter((a) => !(a.excerpt || '').trim() && !(a.subtitle || '').trim()).map((a) => a.title.slice(0, 50));
    assert(bad.length === 0, `${bad.length} without: ` + bad.slice(0, 4).join(' | '));
  }, { level: 'warn', severity: 'medium' });
  await test('excerpts are within the 200-character limit', () => {
    const bad = articles.filter((a) => (a.excerpt || '').length > 200).map((a) => a.slug.slice(0, 40));
    assert(bad.length === 0, bad.join(', '));
  }, { level: 'warn', severity: 'low' });
  await test('no duplicate published articles (same title published more than once)', () => {
    const by = {};
    for (const a of published) (by[a.title.trim().toLowerCase()] = by[a.title.trim().toLowerCase()] || []).push(a);
    const dups = Object.values(by).filter((g) => g.length > 1).map((g) => `"${g[0].title.slice(0, 40)}" x${g.length}`);
    assert(dups.length === 0, dups.join(' | '));
  }, { level: 'warn', severity: 'medium' });
  await test('published markdown does not use a top-level "# " heading (the page already has its own h1)', () => {
    const bad = published.filter((a) => /^# [^#]/m.test(md(a))).map((a) => a.title.slice(0, 40));
    assert(bad.length === 0, bad.length + ': ' + bad.join(' | '));
  }, { level: 'warn', severity: 'low' });
  const noLinks = published.filter((a) => !/https?:\/\//.test(md(a)));
  finding('medium', 'Sourcing', `${noLinks.length} of ${published.length} published articles contain no links at all (editorial policy asks for named sources)`);

  // ---------- Editorial workflow health
  await test('nothing has been waiting for editor review for more than 3 days', () => {
    const stuck = articles.filter((a) => ['pending', 'pending_editorial'].includes(a.status) && age(a.updated_at) > 3).map((a) => `${a.title.slice(0, 40)} (${age(a.updated_at)}d)`);
    assert(stuck.length === 0, stuck.join(' | '));
  }, { level: 'warn', severity: 'medium' });
  await test('no approved article has been waiting for its writer to publish for more than 7 days', () => {
    const stuck = articles.filter((a) => a.status === 'approved_pending_publish' && age(a.updated_at) > 7).map((a) => `${a.title.slice(0, 40)} (${age(a.updated_at)}d)`);
    assert(stuck.length === 0, stuck.join(' | '));
  }, { level: 'warn', severity: 'low' });
  const { data: fb } = await sb.from('article_feedback').select('article_id,round,sent_at,email_sent,resubmitted_at');
  await test('every editor-feedback round emailed the writer successfully', () => {
    const bad = fb.filter((r) => !r.email_sent).map((r) => `${r.article_id.slice(0, 8)} round ${r.round}`);
    assert(bad.length === 0, 'writer not emailed: ' + bad.join(', '));
    return `${fb.length} rounds, all emailed`;
  });
  await test('no feedback round has gone unanswered by the writer for more than 14 days', () => {
    const open = fb.filter((r) => !r.resubmitted_at && age(r.sent_at) > 14).map((r) => `${r.article_id.slice(0, 8)} (${age(r.sent_at)}d)`);
    assert(open.length === 0, open.join(', '));
  }, { level: 'warn', severity: 'low' });
  await test('articles that have had feedback are never left in an auto-published state', () => {
    const ids = new Set(fb.map((r) => r.article_id));
    const bad = articles.filter((a) => ids.has(a.id) && a.status === 'pending').map((a) => a.title.slice(0, 40));
    assert(bad.length === 0, bad.join(', '));
  });

  // ---------- Writers and applications
  const { data: profiles } = await sb.from('profiles').select('id,email,full_name,pen_name,role,roles,application_status,subscription_status,created_at,writer_reminder_opt_out');
  finding('info', 'Accounts', `${profiles.length} profiles; ${profiles.filter((p) => p.role === 'journalist').length} writers; ${profiles.filter((p) => p.role === 'advertiser').length} advertiser`);
  await test('no writer application has waited more than 48 hours for a decision (the site promises 24 hours)', () => {
    const waiting = profiles.filter((p) => ['pending', 'submitted'].includes(String(p.application_status || '').toLowerCase()) && age(p.created_at) > 2).map((p) => `${p.full_name} (${age(p.created_at)}d)`);
    assert(waiting.length === 0, waiting.join(', '));
  }, { level: 'warn', severity: 'medium' });
  await test('every active writer has a pen name and a unique email', () => {
    const writers = profiles.filter((p) => p.role === 'journalist' && p.subscription_status === 'active');
    const noPen = writers.filter((p) => !(p.pen_name || '').trim()).map((p) => p.email);
    assert(noPen.length === 0, 'no pen name: ' + noPen.join(', '));
    const emails = profiles.map((p) => (p.email || '').toLowerCase());
    assert(new Set(emails).size === emails.length, 'duplicate profile emails');
  }, { level: 'warn', severity: 'low' });

  // ---------- Newsletter
  const { data: subs } = await sb.from('subscribers').select('email,confirmed,unsubscribed_at,subscribed_at');
  const confirmed = subs.filter((s) => s.confirmed && !s.unsubscribed_at);
  const paid = profiles.filter((p) => p.subscription_status === 'active' && p.role !== 'journalist');
  finding('info', 'Newsletter audience', `${subs.length} subscribers, ${confirmed.length} confirmed; weekly newsletter reaches ${confirmed.length} free + paid readers`);
  await test('the weekly newsletter has recipients (it only emails CONFIRMED subscribers)', () => {
    assert(confirmed.length > 0, `0 of ${subs.length} subscribers are confirmed, so the weekly newsletter emails nobody`);
  }, { level: 'warn', severity: 'high' });
  await test('subscriber addresses are unique and do not look machine-generated', () => {
    const lower = subs.map((s) => s.email.toLowerCase());
    assert(new Set(lower).size === lower.length, 'duplicate subscriber emails');
    const botty = subs.filter((s) => (s.email.split('@')[0].match(/\./g) || []).length >= 4).map((s) => s.email);
    assert(botty.length === 0, botty.length + ' look like bot sign-ups (many dots): ' + botty.slice(0, 3).join(', '));
  }, { level: 'warn', severity: 'low' });
  await test('subscriber unsubscribe column is actually being used (nobody can unsubscribe if it is not)', () => {
    const code = execSync('git grep -c unsubscribed_at -- app lib || true', { cwd: ROOT }).toString();
    assert(/unsubscribed_at/.test(code), 'no code writes subscribers.unsubscribed_at; the newsletter has no working unsubscribe for subscribers');
  }, { level: 'warn', severity: 'medium' });

  // ---------- Outreach campaign
  const { data: out } = await sb.from('outreach_recipients').select('email,status,scheduled_date');
  const { data: supp } = await sb.from('email_suppressions').select('email,reason,suppressed_at');
  finding('info', 'Outreach campaign', `${out.length} recipients: ${['sent', 'pending', 'failed', 'suppressed'].map((s) => out.filter((o) => o.status === s).length + ' ' + s).join(', ')}; ${supp.length} on suppression list`);
  await test('outreach: nothing is stuck pending or failed past its scheduled date', () => {
    const today = new Date().toISOString().slice(0, 10);
    const bad = out.filter((o) => ['pending', 'failed'].includes(o.status) && o.scheduled_date < today);
    assert(bad.length === 0, bad.length + ' overdue');
  });
  await test('outreach: nobody on the suppression list is still queued to be emailed', () => {
    const s = new Set(supp.map((x) => x.email.toLowerCase()));
    const bad = out.filter((o) => o.status === 'pending' && s.has(o.email.toLowerCase())).map((o) => o.email);
    assert(bad.length === 0, bad.join(', '));
  });
  await test('suppression list has unique, lower-case addresses', () => {
    assert(supp.every((x) => x.email === x.email.toLowerCase().trim()), 'non-normalised email');
    assert(new Set(supp.map((x) => x.email)).size === supp.length, 'duplicates');
  });
  await test('bounces and complaints are being recorded (otherwise future sends repeat to dead addresses)', () => {
    const kinds = new Set(supp.map((x) => x.reason));
    assert(kinds.has('bounced') || kinds.has('complained'), `only "${[...kinds].join(', ')}" ever recorded; no bounce/complaint handling feeds the list`);
  }, { level: 'warn', severity: 'medium' });

  // ---------- Settings, money and ads
  const { data: settings } = await sb.from('site_settings').select('key,value');
  await test('required site settings exist (writer share %, payment minimum)', () => {
    const keys = new Set(settings.map((s) => s.key));
    const missing = ['journalist_revenue_share_percent', 'writer_payment_minimum_gbp'].filter((k) => !keys.has(k));
    assert(missing.length === 0, 'missing: ' + missing.join(', '));
  });
  await test('settings left over from the old advertising model are not out of step with live pricing', () => {
    const old = settings.filter((s) => /^ad_price_\d+_days$/.test(s.key));
    assert(old.length === 0, `${old.length} legacy ad_price_*_days settings still stored (old 7/14/30/60/90-day pricing)`);
  }, { level: 'warn', severity: 'low' });
  const { count: ads } = await sb.from('advertisements').select('*', { count: 'exact', head: true });
  const { count: held } = await sb.from('advertisements').select('*', { count: 'exact', head: true }).eq('status', 'pending_review').eq('ai_review_status', 'manual_review');
  finding('info', 'Advertising', `${ads} advertisements in total, ${held} held for manual approval`);
  await test('no advertisement is stuck in "pending_payment" or held for review for more than 3 days', async () => {
    const { data: stuck } = await sb.from('advertisements').select('id,status,ai_review_status,updated_at').in('status', ['pending_payment', 'pending_review']);
    const bad = (stuck || []).filter((a) => age(a.updated_at) > 3);
    assert(bad.length === 0, bad.length + ' stuck: ' + bad.map((a) => `${a.status}/${a.ai_review_status} ${age(a.updated_at)}d`).join(', '));
  }, { level: 'warn', severity: 'medium' });

  // ---------- Migrations
  await test('every local database migration has been applied to the live database (and vice versa)', () => {
    let out;
    try { out = execSync('supabase migration list', { cwd: ROOT, timeout: 60000 }).toString(); } catch (e) { throw new Error('could not run supabase migration list: ' + String(e.message).slice(0, 80)); }
    // The CLI prints JSON when it is not attached to a terminal, a table otherwise.
    const jsonLine = out.split(/\r?\n/).find((l) => l.trim().startsWith('{'));
    let rows;
    if (jsonLine) {
      rows = JSON.parse(jsonLine).migrations.map((m) => [m.local || '', m.remote || '']);
    } else {
      rows = out.split(/\r?\n/).map((l) => l.split('|').map((c) => c.trim())).filter((c) => c.length >= 2 && /^\d{10,}$/.test(c[0] || c[1] || ''));
    }
    assert(rows.length > 10, 'could not read the migration list (' + rows.length + ' rows)');
    const notRemote = rows.filter((c) => c[0] && !c[1]).map((c) => c[0]);
    const notLocal = rows.filter((c) => !c[0] && c[1]).map((c) => c[1]);
    assert(notRemote.length === 0 && notLocal.length === 0, `not applied remotely: ${notRemote.join(',') || 'none'} | remote only: ${notLocal.join(',') || 'none'}`);
    return rows.length + ' migrations in sync';
  }, { level: 'warn', severity: 'medium' });
}
