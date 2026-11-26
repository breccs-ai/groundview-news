// End-to-end flows against a LOCAL dev server (opt-in).
//
//   ADMIN_PASSWORD=local-test-admin-pass UNSUBSCRIBE_TOKEN_SECRET=local-unsub-secret npx next dev -p 3100
//   node tests/regression/run.mjs local
//
// The dev server talks to the real database, so every record these tests create
// is a disposable "zz-" row or your own test writer account, restored afterwards.
// Email is never sent from here (no Resend key locally); the code reports that
// honestly and the tests check for it.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { suite, test, finding, assert } from '../framework.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..');
const BASE = process.env.LOCAL_URL || 'http://localhost:3100';
const PASS = process.env.LOCAL_ADMIN_PASSWORD || 'local-test-admin-pass';
const UNSUB_SECRET = process.env.LOCAL_UNSUBSCRIBE_SECRET || 'local-unsub-secret';
const RUN = 20 + Math.floor(Math.random() * 200); // unique per run so login throttling from an earlier run cannot interfere
const JSON_H = { 'Content-Type': 'application/json' };

const status = async (p, o = {}) => (await fetch(BASE + p, { redirect: 'manual', ...o })).status;

export default async function run() {
  suite('Local end-to-end flows: ' + BASE);
  try { await fetch(BASE + '/api/admin-auth'); } catch { finding('high', 'Local suite skipped', `no dev server at ${BASE}; see the header of suites/local.mjs`); return; }

  const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
  const { createClient } = require(path.join(ROOT, 'node_modules', '@supabase/supabase-js'));
  const URL_ = env.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/)[1];
  const ANON = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY="([^"]+)"/)[1];
  const sb = createClient(URL_, env.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)[1], { auth: { persistSession: false } });

  // ---------- Admin sign-in
  const key = createHash('sha256').update('gvn-admin-session-v1:' + PASS).digest('hex');
  const tokenFor = (exp, k = key) => exp + '.' + createHmac('sha256', k).update('admin:' + exp).digest('hex');
  const future = Math.floor(Date.now() / 1000) + 3600, past = Math.floor(Date.now() / 1000) - 10;
  const cookie = (c) => ({ headers: { Cookie: c } });
  const adminPaths = ['/api/admin/articles', '/api/admin/subscribers', '/api/admin/kyc', '/api/admin/writer-payments', '/api/admin/advertisements', '/api/admin/articles/request-changes', '/api/articles?id=00000000-0000-0000-0000-000000000000'];

  await test('forged, expired, tampered and wrong-key admin tokens are refused everywhere', async () => {
    for (const c of ['gvn_admin_session=authenticated', 'gvn_admin_present=1', 'gvn_admin_session=' + tokenFor(past), 'gvn_admin_session=' + tokenFor(future, 'a'.repeat(64)), 'gvn_admin_session=' + (future + 9999) + '.' + tokenFor(future).split('.')[1], 'gvn_admin_session=abc.def']) {
      for (const p of adminPaths) assert((await status(p, cookie(c))) === 401, `${c.slice(0, 40)} accepted on ${p}`);
    }
  });
  await test('a correctly signed token is accepted (control)', async () => {
    assert((await status('/api/admin/articles', cookie('gvn_admin_session=' + tokenFor(future)))) === 200);
  });
  const login = (pw, ip) => fetch(BASE + '/api/admin-auth', { method: 'POST', headers: { ...JSON_H, 'x-forwarded-for': ip }, body: JSON.stringify({ password: pw }) });
  await test('login: wrong password 401, five failures lock that address out (429), another address unaffected', async () => {
    assert((await login('wrong', `10.${RUN}.0.1`)).status === 401);
    for (let i = 0; i < 5; i++) await login('nope', `10.${RUN}.0.2`);
    assert((await login(PASS, `10.${RUN}.0.2`)).status === 429, 'not throttled');
    assert((await login(PASS, `10.${RUN}.0.3`)).status === 200, 'other address blocked');
  });
  let sessionCookie = '';
  await test('login issues an httpOnly signed session cookie plus a readable, secret-free marker', async () => {
    const r = await login(PASS, `10.${RUN}.0.4`);
    const set = r.headers.getSetCookie();
    const session = set.find((c) => c.startsWith('gvn_admin_session=')), marker = set.find((c) => c.startsWith('gvn_admin_present='));
    assert(/httponly/i.test(session) && /^gvn_admin_session=\d+\.[0-9a-f]{64}/.test(session), 'session cookie: ' + session);
    assert(marker && !/httponly/i.test(marker) && marker.startsWith('gvn_admin_present=1'), 'marker cookie');
    sessionCookie = session.split(';')[0];
  });
  await test('a real session reads the article list; the session check agrees; logout clears both cookies', async () => {
    assert((await status('/api/admin/articles', cookie(sessionCookie))) === 200);
    assert((await (await fetch(BASE + '/api/admin-auth/session', cookie(sessionCookie))).json()).authenticated === true);
    const out = await fetch(BASE + '/api/admin-auth/logout', { method: 'POST', headers: { Cookie: sessionCookie } });
    const set = out.headers.getSetCookie().join(' | ');
    assert(/gvn_admin_session=;/.test(set) && /gvn_admin_present=;/.test(set) && /max-age=0/i.test(set), set);
  });
  const adminH = { Cookie: sessionCookie, ...JSON_H };
  const baseArt = { author_name: 'ZZ', category: 'world-politics', label: 'Commentary', body: { markdown: 'x' } };
  await test('admin article actions: reject, unpublish, delete work and need a session', async () => {
    const { data: a } = await sb.from('articles').insert({ ...baseArt, title: 'ZZ ADMIN ACTIONS', slug: 'zz-test-admin-' + Date.now(), status: 'draft' }).select('id').single();
    try {
      assert((await status('/api/admin/articles', { method: 'POST', headers: JSON_H, body: JSON.stringify({ action: 'reject', article_id: a.id }) })) === 401);
      assert((await status('/api/admin/articles', { method: 'POST', headers: adminH, body: JSON.stringify({ action: 'explode', article_id: a.id }) })) === 400);
      assert((await status('/api/admin/articles', { method: 'POST', headers: adminH, body: JSON.stringify({ action: 'reject', article_id: a.id }) })) === 200 && (await sb.from('articles').select('status').eq('id', a.id).single()).data.status === 'rejected');
      assert((await status('/api/admin/articles', { method: 'POST', headers: adminH, body: JSON.stringify({ action: 'unpublish', article_id: a.id }) })) === 200 && (await sb.from('articles').select('status').eq('id', a.id).single()).data.status === 'draft');
      assert((await status('/api/admin/articles', { method: 'DELETE', headers: JSON_H, body: JSON.stringify({ article_id: a.id }) })) === 401 && (await sb.from('articles').select('id').eq('id', a.id)).data.length === 1, 'delete without session');
      assert((await status('/api/admin/articles', { method: 'DELETE', headers: adminH, body: JSON.stringify({ article_id: a.id }) })) === 200 && (await sb.from('articles').select('id').eq('id', a.id)).data.length === 0, 'delete with session');
    } finally { await sb.from('articles').delete().like('slug', 'zz-test-admin-%'); }
  });

  // ---------- Editor feedback workflow (uses your own test writer account)
  const { data: prof } = await sb.from('profiles').select('id,email').eq('email', 'stanley.nyadzayo@breccs.com').single();
  const original = 'The first paragraph makes a claim about trade policy.\n\nThe second paragraph says experts agree on the outcome.\n\nThe third paragraph is the conclusion.';
  const revised = 'The first paragraph makes a claim about trade policy (source: https://www.wto.org/report-example).\n\nThe second paragraph says experts agree on the outcome, according to the OECD (https://www.oecd.org/example).\n\nThe third paragraph is the conclusion.\n\nA new fourth paragraph with data from https://data.worldbank.org/example.';
  const A = { Cookie: (await (async () => { const r = await login(PASS, `10.${RUN}.0.9`); return r.headers.getSetCookie().find((c) => c.startsWith('gvn_admin_session=')).split(';')[0]; })()), ...JSON_H };
  const slug = 'zz-test-feedback-' + Date.now();
  const { data: art } = await sb.from('articles').insert({ ...baseArt, title: 'ZZ TEST feedback flow', slug, author_id: prof.id, author_email: prof.email, status: 'pending_editorial', editorial_category: 'political-commentary', excerpt: 'Test excerpt', body: { markdown: original } }).select('id').single();
  const id = art.id;
  const post = (items, extra = {}) => fetch(BASE + '/api/admin/articles/request-changes', { method: 'POST', headers: A, body: JSON.stringify({ article_id: id, items, ...extra }) });
  let W;
  try {
    await test('feedback: validation (needs a session, rejects empty comments, 404 for a missing article)', async () => {
      assert((await status('/api/admin/articles/request-changes', { method: 'POST', headers: JSON_H, body: JSON.stringify({ article_id: id, items: ['x'] }) })) === 401);
      assert((await post(['  ', ''])).status === 400);
      const r = await fetch(BASE + '/api/admin/articles/request-changes', { method: 'POST', headers: A, body: JSON.stringify({ article_id: '00000000-0000-0000-0000-000000000000', items: ['x'] }) });
      assert(r.status === 404);
    });
    await test('feedback: round 1 saves a snapshot, returns the article to the writer as a draft, reports email honestly', async () => {
      const r = await post(['Add named sources for the trade claim.', 'Attribute "experts agree".'], { note: 'Happy to look again.' });
      const j = await r.json();
      assert(r.status === 200 && j.round === 1, JSON.stringify(j));
      assert(j.email_sent === false, 'locally there is no email key, so email_sent must be false, not faked');
      assert((await sb.from('articles').select('status').eq('id', id).single()).data.status === 'draft');
      const { data: fb } = await sb.from('article_feedback').select('*').eq('article_id', id);
      assert(fb.length === 1 && fb[0].snapshot.markdown === original && fb[0].items.length === 2 && !fb[0].resubmitted_at);
    });
    const { data: link } = await sb.auth.admin.generateLink({ type: 'magiclink', email: prof.email });
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: sess } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
    W = { Authorization: 'Bearer ' + sess.session.access_token, ...JSON_H };
    await test('feedback: the writer sees the comments when opening the article', async () => {
      const j = await (await fetch(BASE + '/api/articles?id=' + id, { headers: W })).json();
      assert(j.feedback && j.feedback.items.length === 2 && j.feedback.round === 1 && !j.feedback.resubmitted_at);
    });
    const patch = (md, extra = {}) => fetch(BASE + '/api/articles', { method: 'PATCH', headers: W, body: JSON.stringify({ id, title: 'ZZ TEST feedback flow', body: { markdown: md }, status: 'pending', category: 'world-politics', editorial_category: 'political-commentary', label: 'Commentary', excerpt: 'Test excerpt', ...extra }) });
    await test('feedback: resubmission goes to human review and records a diff (links 0 -> 3, 1 paragraph added, 2 edited)', async () => {
      const r = await patch(revised);
      assert(r.status === 200);
      assert((await sb.from('articles').select('status').eq('id', id).single()).data.status === 'pending_editorial');
      const { data: f } = await sb.from('article_feedback').select('resubmitted_at,resubmission_summary').eq('article_id', id).eq('round', 1).single();
      const s = f.resubmission_summary || {};
      assert(f.resubmitted_at && s.linksBefore === 0 && s.linksAfter === 3 && s.paragraphsAdded === 1 && s.paragraphsModified === 2, JSON.stringify(s));
    });
    await test('feedback: an article with feedback history is never auto-reviewed or published (general category, too short to pass)', async () => {
      await sb.from('articles').update({ editorial_category: 'general', body: { markdown: 'Too short.' }, status: 'pending' }).eq('id', id);
      const r = await fetch(BASE + '/api/articles/review', { method: 'POST', headers: W, body: JSON.stringify({ article_id: id }) });
      const j = await r.json();
      const st = (await sb.from('articles').select('status').eq('id', id).single()).data.status;
      assert(j.outcome === 'pending_editorial' && st === 'pending_editorial', JSON.stringify(j) + ' status=' + st);
    });
    await test('review endpoint: refuses anonymous callers, other writers and articles that are not awaiting review', async () => {
      const review = (headers, aid = id) => fetch(BASE + '/api/articles/review', { method: 'POST', headers, body: JSON.stringify({ article_id: aid }) });
      const statusOf = async (aid) => (await sb.from('articles').select('status').eq('id', aid).single()).data.status;
      // anonymous
      await sb.from('articles').update({ status: 'pending' }).eq('id', id);
      assert((await review(JSON_H)).status === 401, 'anonymous was not refused');
      assert((await statusOf(id)) === 'pending', 'anonymous call changed the article');
      // a different writer's article
      const { data: other } = await sb.from('profiles').select('id,email').neq('id', prof.id).limit(1).single();
      const { data: foreign } = await sb.from('articles').insert({ ...baseArt, title: 'ZZ TEST foreign article', slug: 'zz-test-foreign-' + Date.now(), author_id: other.id, author_email: other.email, status: 'pending', editorial_category: 'general' }).select('id').single();
      try {
        assert((await review(W, foreign.id)).status === 403, 'another writer could review this article');
        assert((await statusOf(foreign.id)) === 'pending');
        // own article, but already approved or published: cannot be re-run
        for (const st of ['approved_pending_publish', 'published', 'draft', 'rejected']) {
          const up = await sb.from('articles').update({ status: st, ...(st === 'published' ? { publish_at: new Date().toISOString() } : {}) }).eq('id', id);
          assert(!up.error, 'test setup failed: ' + (up.error && up.error.message));
          const r = await review(W);
          assert(r.status === 409 && (await statusOf(id)) === st, st + ': got ' + r.status + ', status now ' + (await statusOf(id)));
        }
        // admin cookie is accepted
        await sb.from('articles').update({ status: 'pending', editorial_category: 'political-commentary' }).eq('id', id);
        const ra = await review(A);
        assert(ra.status === 200, 'admin refused: ' + ra.status);
      } finally { await sb.from('articles').delete().like('slug', 'zz-test-foreign-%'); }
    });
    await test('feedback: round 2 numbers correctly and an unchanged resubmission is detected', async () => {
      await sb.from('articles').update({ editorial_category: 'political-commentary', body: { markdown: revised } }).eq('id', id);
      const j = await (await post(['Add one more independent source.'])).json();
      assert(j.round === 2);
      await patch(revised);
      const { data: f } = await sb.from('article_feedback').select('resubmission_summary').eq('article_id', id).eq('round', 2).single();
      const s = f.resubmission_summary || {};
      assert(s.paragraphsAdded === 0 && s.paragraphsModified === 0 && s.paragraphsRemoved === 0, JSON.stringify(s));
    });
    await test('writers cannot read other writers\' unpublished articles with their own session', async () => {
      const writer = createClient(URL_, ANON, { auth: { persistSession: false } });
      await writer.auth.setSession({ access_token: sess.session.access_token, refresh_token: sess.session.refresh_token });
      const { data } = await writer.from('articles').select('id').neq('status', 'published').neq('author_id', prof.id);
      assert(data.length === 0, data.length + ' rows visible');
    });
  } finally {
    await sb.from('articles').delete().eq('id', id);
  }

  // ---------- Unsubscribe pages ask for confirmation
  const sign = (v) => createHmac('sha256', UNSUB_SECRET).update(v).digest('hex');
  await test('outreach unsubscribe: opening the link only asks to confirm; only POST suppresses', async () => {
    const email = 'zz-confirm-test@example.com', tok = sign(email);
    const q = `?email=${encodeURIComponent(email)}&token=${tok}`;
    const count = async () => (await sb.from('email_suppressions').select('email').eq('email', email)).data.length;
    try {
      const g = await (await fetch(BASE + '/api/outreach/unsubscribe' + q)).text();
      assert(/Confirm unsubscribe/.test(g) && g.includes(email) && /method="post"/.test(g), 'no confirmation page');
      assert((await count()) === 0, 'GET unsubscribed someone');
      const bad = await (await fetch(BASE + '/api/outreach/unsubscribe' + `?email=${encodeURIComponent(email)}&token=deadbeef`)).text();
      assert(/invalid or has expired/.test(bad) && !/Confirm unsubscribe/.test(bad) && (await count()) === 0);
      const pbad = await fetch(BASE + '/api/outreach/unsubscribe' + `?email=${encodeURIComponent(email)}&token=deadbeef`, { method: 'POST' });
      assert(/invalid or has expired/.test(await pbad.text()) && (await count()) === 0, 'POST with a bad token wrote');
      const p = await fetch(BASE + '/api/outreach/unsubscribe' + q, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
      assert(p.status === 200 && /have been unsubscribed/.test(await p.text()) && (await count()) === 1, 'POST did not suppress');
    } finally { await sb.from('email_suppressions').delete().eq('email', email); }
  });
  await test('writer reminder unsubscribe: opening the link changes nothing; only POST opts the writer out (restored afterwards)', async () => {
    const original = (await sb.from('profiles').select('writer_reminder_opt_out').eq('id', prof.id).single()).data.writer_reminder_opt_out;
    const q = `?id=${encodeURIComponent(prof.id)}&token=${sign(prof.id)}`;
    const flag = async () => (await sb.from('profiles').select('writer_reminder_opt_out').eq('id', prof.id).single()).data.writer_reminder_opt_out;
    try {
      await sb.from('profiles').update({ writer_reminder_opt_out: false }).eq('id', prof.id);
      const g = await (await fetch(BASE + '/api/journalists/unsubscribe-reminders' + q)).text();
      assert(/Confirm unsubscribe/.test(g) && /method="post"/.test(g), 'no confirmation page');
      assert((await flag()) === false, 'GET opted the writer out');
      const bad = await (await fetch(BASE + '/api/journalists/unsubscribe-reminders' + `?id=${prof.id}&token=deadbeef`, { method: 'POST' })).text();
      assert(/invalid or has expired/.test(bad) && (await flag()) === false);
      const p = await fetch(BASE + '/api/journalists/unsubscribe-reminders' + q, { method: 'POST' });
      assert(p.status === 200 && (await flag()) === true, 'POST did not opt out');
    } finally { await sb.from('profiles').update({ writer_reminder_opt_out: original }).eq('id', prof.id); }
  });
  // ---------- Cache purge endpoint and response headers
  await test('/api/revalidate: refused without an admin session, works with one', async () => {
    const body = JSON.stringify({ slug: 'zz-regression-probe' });
    assert((await status('/api/revalidate', { method: 'POST', headers: JSON_H, body })) === 401, 'anonymous request was accepted');
    const r = await fetch(BASE + '/api/revalidate', { method: 'POST', headers: A, body });
    assert(r.status === 200 && (await r.json()).revalidated === true, 'admin request failed: ' + r.status);
  });
  await test('every response carries nosniff, frame protection and a referrer policy, and does not advertise Next.js', async () => {
    for (const p of ['/', '/api/admin-auth/session']) {
      const h = (await fetch(BASE + p)).headers;
      assert(h.get('x-content-type-options') === 'nosniff', p + ': X-Content-Type-Options ' + h.get('x-content-type-options'));
      assert(/sameorigin|deny/i.test(h.get('x-frame-options') || ''), p + ': X-Frame-Options ' + h.get('x-frame-options'));
      assert(!!h.get('referrer-policy'), p + ': no Referrer-Policy');
      assert(!h.get('x-powered-by'), p + ': X-Powered-By ' + h.get('x-powered-by'));
    }
  });

  // ---------- Newsletter: double opt-in, unsubscribe and the weekly send list
  const nlSign = (kind, email) => createHmac('sha256', UNSUB_SECRET).update('newsletter:' + kind + ':' + email).digest('hex');
  const nlQ = (kind, email, tok) => '?email=' + encodeURIComponent(email) + '&token=' + (tok || nlSign(kind, email));
  const nlEmail = 'zz-nl-' + Date.now() + '@example.com';
  const nlSubscribe = (email, n) => fetch(BASE + '/api/newsletter', { method: 'POST', headers: { ...JSON_H, 'x-real-ip': '10.' + RUN + '.' + n + '.7' }, body: JSON.stringify({ email, first_name: 'Test', last_name: 'Reader' }) });
  const nlRow = async (email) => (await sb.from('subscribers').select('confirmed,unsubscribed_at').eq('email', email).maybeSingle()).data;
  const nlSupp = async (email) => (await sb.from('email_suppressions').select('reason,source').eq('email', email).maybeSingle()).data;
  try {
    await test('newsletter: signing up stores an UNCONFIRMED address and asks the reader to confirm (email reported honestly)', async () => {
      const r = await nlSubscribe(nlEmail, 1);
      const j = await r.json();
      assert(r.status === 200 && j.ok === true, JSON.stringify(j));
      assert(j.confirmation_sent === false, 'locally there is no email key, so confirmation_sent must be false, not faked');
      const row = await nlRow(nlEmail);
      assert(row && row.confirmed === false, 'row should exist and be unconfirmed: ' + JSON.stringify(row));
      const again = await nlSubscribe(nlEmail, 2);
      assert(again.status === 200, 'signing up again while unconfirmed should resend the confirmation, got ' + again.status);
    });
    await test('newsletter: the confirm link only shows a button on GET, rejects bad or wrong-purpose tokens, and POST confirms', async () => {
      const g = await (await fetch(BASE + '/api/newsletter/confirm' + nlQ('confirm', nlEmail))).text();
      assert(/Confirm my subscription/.test(g) && /method="post"/.test(g), 'no confirmation page');
      assert((await nlRow(nlEmail)).confirmed === false, 'GET confirmed someone');
      const bad = await (await fetch(BASE + '/api/newsletter/confirm' + nlQ('confirm', nlEmail, 'deadbeef'))).text();
      assert(/invalid or has expired/.test(bad));
      const wrongKind = await fetch(BASE + '/api/newsletter/confirm' + nlQ('confirm', nlEmail, nlSign('unsubscribe', nlEmail)), { method: 'POST' });
      assert(/invalid or has expired/.test(await wrongKind.text()) && (await nlRow(nlEmail)).confirmed === false, 'an unsubscribe token confirmed a signup');
      const p = await fetch(BASE + '/api/newsletter/confirm' + nlQ('confirm', nlEmail), { method: 'POST' });
      assert(/subscription is confirmed/.test(await p.text()) && (await nlRow(nlEmail)).confirmed === true, 'POST did not confirm');
      assert((await nlSubscribe(nlEmail, 3)).status === 409, 'a confirmed subscriber should get already_subscribed');
    });
    const recent = (await sb.from('articles').select('id', { count: 'exact', head: true }).eq('status', 'published').gte('published_at', new Date(Date.now() - 7 * 864e5).toISOString())).count;
    if (recent > 0) {
      await test('newsletter: the weekly send list includes confirmed readers and leaves out unconfirmed and suppressed ones (dry run, nothing sent)', async () => {
        const dry = async () => (await (await fetch(BASE + '/api/cron/weekly-newsletter?dry_run=1')).json());
        const base = await dry();
        assert(base.dry_run === true && typeof base.recipients_total === 'number', JSON.stringify(base));
        // nlEmail is confirmed and already counted. An unconfirmed address and a confirmed-but-suppressed one must not change the total.
        const extra = ['zz-nl-unconfirmed-' + Date.now() + '@example.com', 'zz-nl-suppressed-' + Date.now() + '@example.com'];
        await sb.from('subscribers').insert([{ email: extra[0], first_name: 'T', last_name: 'R', confirmed: false }, { email: extra[1], first_name: 'T', last_name: 'R', confirmed: true }]);
        await sb.from('email_suppressions').insert({ email: extra[1], reason: 'unsubscribed', source: 'newsletter' });
        const after = await dry();
        assert(after.recipients_total === base.recipients_total && after.skipped_suppressed === base.skipped_suppressed + 1, 'before ' + JSON.stringify(base) + ' after ' + JSON.stringify(after));
      });
    }
    await test('newsletter: the unsubscribe link only asks on GET; POST removes the reader and suppresses the address; confirming again lifts it', async () => {
      const g = await (await fetch(BASE + '/api/newsletter/unsubscribe' + nlQ('unsubscribe', nlEmail))).text();
      assert(/Confirm unsubscribe/.test(g) && /method="post"/.test(g));
      assert((await nlRow(nlEmail)) && !(await nlSupp(nlEmail)), 'GET unsubscribed someone');
      const bad = await fetch(BASE + '/api/newsletter/unsubscribe' + nlQ('unsubscribe', nlEmail, 'deadbeef'), { method: 'POST' });
      assert(/invalid or has expired/.test(await bad.text()) && (await nlRow(nlEmail)), 'POST with a bad token wrote');
      const wrongKind = await fetch(BASE + '/api/newsletter/unsubscribe' + nlQ('unsubscribe', nlEmail, nlSign('confirm', nlEmail)), { method: 'POST' });
      assert(/invalid or has expired/.test(await wrongKind.text()) && (await nlRow(nlEmail)), 'a confirm token unsubscribed a reader');
      const p = await fetch(BASE + '/api/newsletter/unsubscribe' + nlQ('unsubscribe', nlEmail), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
      assert(/have been unsubscribed/.test(await p.text()), 'POST did not unsubscribe');
      const sup = await nlSupp(nlEmail);
      assert(!(await nlRow(nlEmail)) && sup && sup.reason === 'unsubscribed' && sup.source === 'newsletter', 'row or suppression wrong: ' + JSON.stringify(sup));
      // Signing up and confirming again is a fresh opt-in
      assert((await nlSubscribe(nlEmail, 4)).status === 200);
      await fetch(BASE + '/api/newsletter/confirm' + nlQ('confirm', nlEmail), { method: 'POST' });
      assert((await nlRow(nlEmail)).confirmed === true && !(await nlSupp(nlEmail)), 're-confirming did not lift the newsletter unsubscribe');
    });
  } finally {
    await sb.from('subscribers').delete().like('email', 'zz-nl-%');
    await sb.from('email_suppressions').delete().like('email', 'zz-nl-%');
  }

  await test('cleanup: no test articles or suppression rows were left in the database', async () => {
    const left = (await sb.from('articles').select('id').like('slug', 'zz-%')).data.length;
    const supp = (await sb.from('email_suppressions').select('email').like('email', 'zz-%')).data.length;
    const subs = (await sb.from('subscribers').select('email').like('email', 'zz-%')).data.length;
    assert(left === 0 && supp === 0 && subs === 0, `${left} test articles, ${supp} test suppression rows, ${subs} test subscribers left behind`);
  });
}
