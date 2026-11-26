// Security and API-contract regression against BASE_URL. Read-only apart from
// private "zz-" probe rows in the database, which are always removed.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { suite, test, finding, assert, pool } from '../framework.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..');
const BASE = (process.env.BASE_URL || 'https://groundviewnews.com').replace(/\/$/, '');
const FORGED = { Cookie: 'gvn_admin_session=authenticated' };
const JSON_H = { 'Content-Type': 'application/json' };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'route.ts') out.push(p);
  }
  return out;
}
const routes = walk(path.join(ROOT, 'app', 'api')).map((f) => '/' + path.relative(path.join(ROOT, 'app'), path.dirname(f)).split(path.sep).join('/'));
const dynamic = (r) => r.includes('[');

// Routes that are open to anonymous visitors by design.
const PUBLIC = new Set([
  '/api/ads/display', '/api/ads/track', '/api/articles/view', '/api/newsletter', '/api/contact', '/api/advertise-enquiry',
  '/api/writer/apply', '/api/journalist/register', '/api/advertiser/register', '/api/outreach/unsubscribe', '/api/newsletter/confirm', '/api/newsletter/unsubscribe',
  '/api/journalists/unsubscribe-reminders', '/api/admin-auth', '/api/admin-auth/logout', '/api/admin-auth/session',
  '/api/webhooks/stripe', '/api/advertiser/kyc/webhook', '/api/subscribe/success', '/api/advertiser/validate-ad',
  '/api/me/subscription',
]);

async function req(p, opts = {}) {
  const r = await fetch(BASE + p, { redirect: 'manual', ...opts });
  const text = await r.text().catch(() => '');
  return { status: r.status, headers: r.headers, text };
}

export default async function run() {
  suite('Security & API contract: ' + BASE);

  const adminRoutes = routes.filter((r) => r.startsWith('/api/admin/'));
  const cronRoutes = routes.filter((r) => r.startsWith('/api/cron/'));
  finding('info', 'Routes discovered', `${routes.length} API routes (${adminRoutes.length} admin, ${cronRoutes.length} cron)`);

  // ---------- Admin
  await test(`all ${adminRoutes.length} admin API routes refuse no session and the old forged cookie (GET and POST)`, async () => {
    const leaks = [];
    await pool(adminRoutes, 6, async (r) => {
      for (const headers of [{}, FORGED]) {
        for (const method of ['GET', 'POST']) {
          const res = await req(r, { method, headers: { ...JSON_H, ...headers }, ...(method === 'POST' ? { body: '{}' } : {}) });
          if (![401, 403, 405].includes(res.status)) leaks.push(`${method} ${r} ${headers.Cookie ? '(forged)' : ''} -> ${res.status}`);
        }
      }
    });
    assert(leaks.length === 0, leaks.join(' | '));
    return `${adminRoutes.length} routes x 4 probes`;
  });
  await test('the articles API refuses forged-admin access (it also accepts the admin cookie)', async () => {
    const res = await req('/api/articles?id=00000000-0000-0000-0000-000000000000', { headers: FORGED });
    assert(res.status === 401, 'HTTP ' + res.status);
    const del = await req('/api/articles', { method: 'DELETE', headers: { ...JSON_H, ...FORGED }, body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000000' }) });
    assert([401, 403, 405].includes(del.status), 'DELETE HTTP ' + del.status);
  });
  await test('admin session endpoint reports not-authenticated for strangers and for the old forged cookie', async () => {
    for (const h of [{}, FORGED]) {
      const r = await req('/api/admin-auth/session', { headers: h });
      assert(JSON.parse(r.text).authenticated === false, 'authenticated for ' + JSON.stringify(h));
    }
  });
  await test('wrong admin password gets 401 and no session cookie', async () => {
    const r = await req('/api/admin-auth', { method: 'POST', headers: { ...JSON_H, 'x-forwarded-for': '203.0.113.' + (Date.now() % 250) }, body: JSON.stringify({ password: 'definitely-not-it' }) });
    assert(r.status === 401 || r.status === 429, 'HTTP ' + r.status);
    assert(!/gvn_admin_session/.test(r.headers.get('set-cookie') || ''), 'a session cookie was issued');
  });

  // ---------- Cron
  await test(`all ${cronRoutes.length} cron routes refuse requests without the secret`, async () => {
    const bad = [];
    for (const r of cronRoutes) {
      for (const headers of [{}, { Authorization: 'Bearer wrong-secret' }, { Authorization: 'Bearer ' }]) {
        const res = await req(r, { headers });
        if (res.status !== 401) bad.push(`${r} ${JSON.stringify(headers).slice(0, 30)} -> ${res.status}`);
      }
    }
    assert(bad.length === 0, bad.join(' | '));
  });

  // ---------- Webhooks
  await test('payment/identity webhooks reject unsigned requests', async () => {
    for (const p of ['/api/webhooks/stripe', '/api/advertiser/kyc/webhook']) {
      const r = await req(p, { method: 'POST', headers: JSON_H, body: JSON.stringify({ type: 'checkout.session.completed', data: { object: {} } }) });
      assert([400, 401, 403].includes(r.status), `${p} -> HTTP ${r.status}`);
    }
  });

  // ---------- Everything else needs a signed-in user: nothing should succeed anonymously
  const protectedRoutes = routes.filter((r) => !r.startsWith('/api/admin/') && !r.startsWith('/api/cron/') && !PUBLIC.has(r) && !dynamic(r));
  await test(`${protectedRoutes.length} user-only API routes do not respond successfully or crash for anonymous callers`, async () => {
    const bad = [];
    await pool(protectedRoutes, 6, async (r) => {
      for (const method of ['GET', 'POST']) {
        const res = await req(r, { method, headers: JSON_H, ...(method === 'POST' ? { body: '{}' } : {}) });
        if (res.status < 300 || res.status >= 500) bad.push(`${method} ${r} -> ${res.status}`);
      }
    });
    assert(bad.length === 0, bad.join(' | '));
    return protectedRoutes.join(', ').slice(0, 140);
  });

  // ---------- Public form endpoints: reject junk gracefully
  await test('public forms reject empty and malformed submissions with a 4xx (never 200 or 500)', async () => {
    const bad = [];
    for (const p of ['/api/contact', '/api/newsletter', '/api/advertise-enquiry']) {
      for (const body of ['{}', 'not json at all', '{"email":"nope"}']) {
        const r = await req(p, { method: 'POST', headers: JSON_H, body });
        if (r.status < 400 || r.status >= 500) bad.push(`${p} <- ${body.slice(0, 12)} -> ${r.status}`);
      }
    }
    assert(bad.length === 0, bad.join(' | '));
  });
  await test('error responses do not leak stack traces or file paths', async () => {
    const leaks = [];
    for (const [p, body] of [['/api/contact', 'not json'], ['/api/articles', '{'], ['/api/outreach/unsubscribe', ''], ['/api/ads/display', '']]) {
      const r = await req(p, { method: 'POST', headers: JSON_H, body });
      if (/node_modules|\.next\/server|at [A-Za-z.]+ \(|webpack-internal|SUPABASE_SERVICE_ROLE/.test(r.text)) leaks.push(p);
    }
    assert(leaks.length === 0, 'leaked on: ' + leaks.join(', '));
  });

  // ---------- Exposed files and source maps
  await test('sensitive files are not served (.env, .git, package.json, config, source)', async () => {
    const exposed = [];
    for (const p of ['/.env', '/.env.local', '/.git/config', '/.git/HEAD', '/package.json', '/next.config.js', '/supabase/config.toml', '/tsconfig.json', '/.vercel/project.json', '/lib/admin-session.ts', '/app/layout.tsx']) {
      const r = await req(p);
      if (r.status === 200 && !/<html/i.test(r.text)) exposed.push(p);
    }
    assert(exposed.length === 0, exposed.join(', '));
  });
  await test('JavaScript source maps are not published', async () => {
    const home = await (await fetch(BASE + '/')).text();
    const chunk = (home.match(/\/_next\/static\/chunks\/[^"']+\.js/) || [])[0];
    assert(chunk, 'no chunk found');
    const r = await req(chunk + '.map');
    assert(r.status !== 200, 'source map is public: ' + chunk);
  }, { level: 'warn', severity: 'low' });

  // ---------- The unauthenticated review endpoint (found by this suite)
  const haveDb = (() => { try { return /SUPABASE_SERVICE_ROLE_KEY="[^"]{20,}"/.test(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')); } catch { return false; } })();
  let sb = null, anon = null, env = '';
  if (haveDb) {
    env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
    const { createClient } = require(path.join(ROOT, 'node_modules', '@supabase', 'supabase-js'));
    const url = env.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/)[1];
    sb = createClient(url, env.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)[1], { auth: { persistSession: false } });
    anon = createClient(url, env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY="([^"]+)"/)[1], { auth: { persistSession: false } });
  }

  if (sb) {
    await test('an anonymous caller cannot change an article\'s status through /api/articles/review', async () => {
      const slug = 'zz-review-auth-' + Date.now();
      const { data: a } = await sb.from('articles').insert({ title: 'ZZ REVIEW AUTH', slug, author_name: 'ZZ', category: 'world-politics', label: 'Commentary', status: 'approved_pending_publish', editorial_category: 'political-commentary', body: { markdown: 'probe' } }).select('id,status').single();
      try {
        const r = await req('/api/articles/review', { method: 'POST', headers: JSON_H, body: JSON.stringify({ article_id: a.id }) });
        const { data: after } = await sb.from('articles').select('status').eq('id', a.id).single();
        assert(after.status === a.status && r.status === 401, `anonymous request returned ${r.status} and changed status ${a.status} -> ${after.status}`);
      } finally { await sb.from('articles').delete().like('slug', 'zz-review-auth-%'); }
    }, { severity: 'high' });

    // ---------- Database exposure through the public key
    const tables = ['subscribers', 'contact_messages', 'profiles', 'advertisements', 'advertiser_profiles', 'moderation_queue', 'writer_feedback', 'article_views', 'article_shares', 'journalist_approval_assignments', 'writer_application_attempts', 'founding_lead_editor_memberships', 'founding_lead_editor_audit_log', 'journalist_communication_preferences', 'journalist_platform_feedback', 'site_settings', 'journalist_revenue_shares', 'writer_payout_profiles', 'writer_payment_requests', 'newsletter_subscribe_attempts', 'contact_message_attempts', 'email_suppressions', 'outreach_recipients', 'article_feedback', 'ad_reminder_log'];
    await test(`the public database key cannot read any of ${tables.length} private tables`, async () => {
      const open = [];
      await pool(tables, 6, async (t) => { const r = await anon.from(t).select('*', { count: 'exact', head: true }); if (!r.error && r.count > 0) open.push(`${t}(${r.count})`); });
      assert(open.length === 0, 'readable: ' + open.join(', '));
    });
    await test('the public database key sees only published articles and cannot write to articles', async () => {
      const { data: unpub } = await anon.from('articles').select('id').neq('status', 'published').limit(1);
      assert(unpub.length === 0, 'unpublished articles readable');
      const slug = 'zz-rls-' + Date.now();
      const { data: row } = await sb.from('articles').insert({ title: 'ZZ RLS', slug, author_name: 'ZZ', category: 'world-politics', label: 'Commentary', status: 'draft', body: { markdown: 'x' } }).select('id').single();
      try {
        await anon.from('articles').update({ title: 'CHANGED' }).eq('id', row.id);
        const { data: t } = await sb.from('articles').select('title').eq('id', row.id).single();
        assert(t.title === 'ZZ RLS', 'public key could UPDATE an article');
        const ins = await anon.from('articles').insert({ title: 'ZZ RLS2', slug: slug + '-2', author_name: 'ZZ', category: 'world-politics', label: 'Commentary', status: 'draft', body: { markdown: 'x' } });
        assert(ins.error, 'public key could INSERT an article');
        await anon.from('articles').delete().eq('id', row.id);
        const { data: still } = await sb.from('articles').select('id').eq('id', row.id);
        assert(still.length === 1, 'public key could DELETE an article');
      } finally { await sb.from('articles').delete().like('slug', 'zz-rls-%'); }
    });
    await test('the public database key cannot add subscribers directly (it would skip the form checks and the email confirmation)', async () => {
      const email = 'zz-anon-sub-' + Date.now() + '@example.com';
      try {
        const ins = await anon.from('subscribers').insert({ email, confirmed: true });
        const { data: row } = await sb.from('subscribers').select('email,confirmed').eq('email', email);
        assert(ins.error && row.length === 0, 'public key could INSERT a confirmed subscriber with only an email address');
      } finally { await sb.from('subscribers').delete().like('email', 'zz-anon-sub-%'); }
    }, { severity: 'high' });
    await test('storage buckets refuse anonymous uploads', async () => {
      const { data: buckets } = await sb.storage.listBuckets();
      const open = [];
      for (const b of buckets) {
        const p = 'zz-probe-' + Date.now() + '.txt';
        const { error } = await anon.storage.from(b.name).upload(p, new Blob(['x']), { contentType: 'text/plain' });
        if (!error) { open.push(b.name); await sb.storage.from(b.name).remove([p]); }
      }
      assert(open.length === 0, 'anonymous upload allowed to: ' + open.join(', '));
    });
  } else {
    finding('info', 'Database exposure tests skipped', 'no service-role key in .env.local');
  }

  // ---------- Other unauthenticated endpoints worth knowing about
  await test('/api/revalidate cannot be called by anonymous visitors (it purges the page cache)', async () => {
    const r = await req('/api/revalidate', { method: 'POST', headers: JSON_H, body: JSON.stringify({ slug: 'zz-regression-probe' }) });
    assert(r.status === 401 || r.status === 403, `anonymous request accepted: HTTP ${r.status}`);
  }, { severity: 'medium' });
}
