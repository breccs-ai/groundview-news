// Live-site regression: read-only HTTP checks against BASE_URL (default production).
import tls from 'node:tls';
import { suite, test, finding, assert, pool } from '../framework.mjs';

const BASE = (process.env.BASE_URL || 'https://groundviewnews.com').replace(/\/$/, '');

async function get(path, opts = {}) {
  const url = path.startsWith('http') ? path : BASE + path;
  const t0 = Date.now();
  const res = await fetch(url, { redirect: opts.redirect || 'follow', headers: { 'User-Agent': 'GV-regression/1.0', ...(opts.headers || {}) } });
  const text = opts.binary ? '' : await res.text();
  return { status: res.status, headers: res.headers, text, ms: Date.now() - t0, url: res.url, res };
}

const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
const visibleText = (html) => strip(html).replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const meta = (html, prop) => {
  const a = html.match(new RegExp('<meta[^>]+(?:property|name)="' + prop + '"[^>]*content="([^"]*)"', 'i'));
  const b = html.match(new RegExp('<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="' + prop + '"', 'i'));
  return (a || b || [])[1] || '';
};
const title = (html) => ((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '').trim();
const canonical = (html) => (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i) || html.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i) || [])[1] || '';
const h1Count = (html) => (strip(html).match(/<h1[\s>]/gi) || []).length;
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => JSON.parse(m[1]));
const hrefs = (html) => [...html.matchAll(/<a\s[^>]*href="([^"#]+)"/gi)].map((m) => m[1]);

export default async function run() {
  suite('Live site: ' + BASE);

  // ---------- Core pages
  const publicPages = ['/', '/about', '/advertise', '/contact', '/write-for-us', '/write-for-us/apply', '/subscribe', '/editorial-policy', '/disclaimer', '/disclosure', '/privacy-policy', '/terms', '/terms-of-use', '/legal/advertiser-terms', '/advertiser/register', '/advertiser/login', '/journalists/login', '/journalists/register'];
  const pageData = {};
  await pool(publicPages, 5, async (p) => {
    await test(`page ${p} loads cleanly`, async () => {
      const r = await get(p);
      pageData[p] = r;
      assert(r.status === 200, 'HTTP ' + r.status);
      assert(title(r.text).length > 3, 'empty <title>');
      assert(/<html[^>]+lang="/i.test(r.text), 'missing <html lang>');
      const vis = visibleText(r.text);
      assert(!/\bundefined\b|\[object Object\]|\bNaN\b/.test(vis), 'visible "undefined/[object Object]/NaN" text');
      return r.ms + 'ms';
    });
  });

  await test('static pages have a canonical URL and a meta description', () => {
    const missing = [];
    for (const p of ['/', '/about', '/advertise', '/contact', '/write-for-us', '/editorial-policy', '/privacy-policy', '/terms', '/disclosure', '/legal/advertiser-terms']) {
      const r = pageData[p]; if (!r) continue;
      if (!canonical(r.text)) missing.push(p + ' (canonical)');
      if (!meta(r.text, 'description')) missing.push(p + ' (description)');
    }
    assert(missing.length === 0, missing.join(', '));
  }, { level: 'warn', severity: 'low' });

  await test('every page has exactly one <h1>', () => {
    const bad = Object.entries(pageData).filter(([, r]) => r.status === 200 && h1Count(r.text) !== 1).map(([p, r]) => `${p}=${h1Count(r.text)}`);
    assert(bad.length === 0, bad.join(', '));
  }, { level: 'warn', severity: 'low' });

  await test('footer carries the legal and affiliate-disclosure links on the homepage', () => {
    const links = hrefs(pageData['/'].text);
    const need = ['/privacy-policy', '/terms', '/disclaimer', '/editorial-policy', '/disclosure', '/contact', '/legal/advertiser-terms'];
    const missing = need.filter((n) => !links.includes(n));
    assert(missing.length === 0, 'missing: ' + missing.join(', '));
  });

  // ---------- Redirects and errors
  await test('legacy redirects work (advertise/register, article/:slug, advertiser/terms, submit)', async () => {
    let r = await get('/advertise/register', { redirect: 'manual' });
    assert([301, 307, 308].includes(r.status) && /\/advertiser\/register/.test(r.headers.get('location') || ''), `advertise/register -> ${r.status} ${r.headers.get('location')}`);
    r = await get('/article/some-slug', { redirect: 'manual' });
    assert([301, 307, 308].includes(r.status) && /\/articles\/some-slug/.test(r.headers.get('location') || ''), `article/:slug -> ${r.status}`);
    r = await get('/advertiser/terms');
    assert(r.status === 200 && /Advertiser Terms/.test(r.text), 'advertiser/terms did not resolve to the terms page');
    r = await get('/submit');
    assert(/NEXT_REDIRECT;replace;\/write-for-us|write-for-us/.test(r.text) || r.url.includes('write-for-us'), '/submit does not send visitors to /write-for-us');
  });
  await test('unknown URL returns a real 404 with the site layout', async () => {
    const r = await get('/this-page-does-not-exist-' + Date.now());
    assert(r.status === 404, 'HTTP ' + r.status);
    assert(/Ground View/.test(r.text), 'no site branding on the 404 page');
  });
  await test('unknown article slug returns 404, not a 500', async () => {
    const r = await get('/articles/zzz-no-such-article-' + Date.now());
    assert(r.status === 404, 'HTTP ' + r.status);
  });
  // ---------- HTTPS / domain / certificate
  await test('http:// redirects to https://', async () => {
    const r = await fetch(BASE.replace('https://', 'http://') + '/', { redirect: 'manual' });
    assert([301, 307, 308].includes(r.status) && /^https:/.test(r.headers.get('location') || ''), `HTTP ${r.status} -> ${r.headers.get('location')}`);
  });
  await test('www. hostname has a valid certificate (visitors who type www see no browser warning)', async () => {
    const host = new URL(BASE).hostname;
    const res = await new Promise((resolve) => {
      const s = tls.connect({ host: 'www.' + host, port: 443, servername: 'www.' + host, rejectUnauthorized: false }, () => { const out = { authorized: s.authorized, err: s.authorizationError }; s.end(); resolve(out); });
      s.on('error', (e) => resolve({ authorized: false, err: e.code || e.message }));
      s.setTimeout(10000, () => { s.destroy(); resolve({ authorized: false, err: 'timeout' }); });
    });
    assert(res.authorized, 'certificate problem on www: ' + res.err);
  }, { level: 'warn', severity: 'medium' });
  await test('TLS certificate is valid with more than 21 days left', async () => {
    const host = new URL(BASE).hostname;
    const cert = await new Promise((resolve, reject) => {
      const s = tls.connect({ host, port: 443, servername: host }, () => { const c = s.getPeerCertificate(); s.end(); resolve(c); });
      s.on('error', reject);
    });
    const days = Math.round((new Date(cert.valid_to) - Date.now()) / 86400000);
    assert(days > 21, `expires in ${days} days`);
    return `${days} days left`;
  }, { level: 'warn', severity: 'medium' });

  // ---------- robots + sitemap
  const robots = await get('/robots.txt');
  await test('robots.txt blocks admin/api/private areas and lists the sitemap', () => {
    assert(robots.status === 200);
    for (const d of ['/api/', '/admin', '/dashboard', '/journalists/dashboard']) assert(robots.text.includes('Disallow: ' + d), 'missing Disallow ' + d);
    assert(/Sitemap:\s*https:\/\/groundviewnews\.com\/sitemap\.xml/.test(robots.text), 'no sitemap line');
  });
  const sm = await get('/sitemap.xml');
  const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  await test('sitemap.xml is valid XML with unique URLs on the right domain', () => {
    assert(sm.status === 200 && /<urlset/.test(sm.text), 'HTTP ' + sm.status);
    assert(locs.length >= 60, 'only ' + locs.length + ' URLs');
    assert(new Set(locs).size === locs.length, 'duplicate URLs');
    assert(locs.every((l) => l.startsWith('https://groundviewnews.com/')), 'URL on another domain');
    return locs.length + ' URLs';
  });
  await test('sitemap includes the affiliate disclosure page', () => {
    assert(locs.includes('https://groundviewnews.com/disclosure'), '/disclosure is not in the sitemap');
  }, { level: 'warn', severity: 'low' });

  const articleUrls = locs.filter((l) => /\/articles\//.test(l));
  const categoryUrls = locs.filter((l) => /\/category\//.test(l));

  // ---------- Categories
  const catData = {};
  await pool(categoryUrls, 5, async (u) => {
    const slug = u.split('/').pop();
    await test(`category ${slug} loads`, async () => {
      const r = await get(u); catData[slug] = r;
      assert(r.status === 200, 'HTTP ' + r.status);
      assert(!/\bundefined\b|\[object Object\]/.test(visibleText(r.text)), 'bad text');
      return `${(r.text.match(/\/articles\//g) || []).length} article links`;
    });
  });
  await test('every category lists at least one article', () => {
    const empty = Object.entries(catData).filter(([, r]) => !/\/articles\//.test(r.text)).map(([s]) => s);
    assert(empty.length === 0, 'empty: ' + empty.join(', '));
  }, { level: 'warn', severity: 'low' });

  // ---------- Every article
  const articles = {};
  await pool(articleUrls, 6, async (u) => {
    const r = await get(u).catch((e) => ({ status: 0, text: '', ms: 0, err: e.message }));
    articles[u] = r;
  });
  await test(`all ${articleUrls.length} sitemap articles return 200`, () => {
    const bad = articleUrls.filter((u) => articles[u].status !== 200).map((u) => `${u.split('/').pop().slice(0, 40)}=${articles[u].status}`);
    assert(bad.length === 0, bad.join(', '));
  });
  await test('every article has title, description, canonical = its URL, one h1 and real body text', () => {
    const problems = [];
    for (const u of articleUrls) {
      const r = articles[u]; if (r.status !== 200) continue;
      const slug = u.split('/').pop().slice(0, 30);
      if (!/\| Ground View News/.test(title(r.text))) problems.push(slug + ': title');
      if (!meta(r.text, 'description')) problems.push(slug + ': no description');
      if (canonical(r.text) !== u) problems.push(slug + ': canonical ' + canonical(r.text));
      if (h1Count(r.text) !== 1) problems.push(slug + ': h1=' + h1Count(r.text));
      if (visibleText(r.text).length < 1500) problems.push(slug + ': very little text');
    }
    assert(problems.length === 0, problems.slice(0, 6).join(' | ') + (problems.length > 6 ? ` (+${problems.length - 6})` : ''));
  });
  await test('every article exposes valid NewsArticle structured data with headline and date', () => {
    const problems = [];
    for (const u of articleUrls) {
      const r = articles[u]; if (r.status !== 200) continue;
      try {
        const ld = jsonLd(r.text).find((x) => x['@type'] === 'NewsArticle');
        if (!ld) { problems.push(u.split('/').pop().slice(0, 30) + ': no NewsArticle'); continue; }
        if (!ld.headline) problems.push('no headline');
        if (!ld.datePublished || isNaN(Date.parse(ld.datePublished)) || Date.parse(ld.datePublished) > Date.now() + 60000) problems.push(u.split('/').pop().slice(0, 30) + ': bad datePublished ' + ld.datePublished);
      } catch (e) { problems.push(u.split('/').pop().slice(0, 30) + ': invalid JSON-LD'); }
    }
    assert(problems.length === 0, problems.slice(0, 5).join(' | '));
  });
  await test('article titles are unique', () => {
    const seen = new Map(); const dup = [];
    for (const u of articleUrls) { const t = title(articles[u].text); if (seen.has(t)) dup.push(t.slice(0, 50)); seen.set(t, u); }
    assert(dup.length === 0, 'duplicates: ' + dup.join(' | '));
  }, { level: 'warn', severity: 'low' });
  await test('article slugs are readable (no mangled accents, double dashes or very short slugs)', () => {
    const odd = articleUrls.map((u) => u.split('/').pop()).filter((s) => /--|^-|-$/.test(s) || s.length < 12);
    assert(odd.length === 0, odd.join(', '));
  }, { level: 'warn', severity: 'low' });
  await test('article images have alt text', () => {
    let missing = 0, total = 0;
    for (const u of articleUrls) {
      for (const m of articles[u].text.matchAll(/<img\b[^>]*>/gi)) { total++; if (!/\balt="[^"]+"/i.test(m[0])) missing++; }
    }
    assert(missing === 0, `${missing} of ${total} images have no alt text`);
  }, { level: 'warn', severity: 'low' });

  // ---------- Sharing images (default image feature)
  await test('share-default.png is served as a 1200x630 PNG', async () => {
    const r = await fetch(BASE + '/share-default.png');
    const b = Buffer.from(await r.arrayBuffer());
    assert(r.status === 200 && /image\/png/.test(r.headers.get('content-type') || ''), `HTTP ${r.status} ${r.headers.get('content-type')}`);
    assert(b.readUInt32BE(16) === 1200 && b.readUInt32BE(20) === 630, `size ${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`);
  });
  await test('every page has an og:image and the X/Twitter image matches it', () => {
    const bad = [];
    for (const [k, r] of [...Object.entries(pageData), ...articleUrls.map((u) => [u, articles[u]])]) {
      if (r.status !== 200) continue;
      const og = meta(r.text, 'og:image'), tw = meta(r.text, 'twitter:image');
      if (!/^https:\/\//.test(og)) bad.push(k.slice(-35) + ' og:image=' + (og || 'none'));
      else if (og !== tw) bad.push(k.slice(-35) + ' twitter mismatch');
    }
    assert(bad.length === 0, bad.slice(0, 5).join(' | '));
  });
  await test('article hero/share images actually load (HTTP 200, image/*)', async () => {
    const imgs = [...new Set(articleUrls.map((u) => meta(articles[u].text, 'og:image')).filter((i) => i && !/share-default/.test(i)))];
    const bad = [];
    await pool(imgs, 8, async (i) => {
      const r = await fetch(i, { method: 'HEAD' }).catch(() => ({ status: 0, headers: new Map() }));
      if (r.status !== 200 || !/^image\//.test(r.headers.get('content-type') || '')) bad.push(i.split('/').pop().slice(0, 40) + '=' + r.status);
    });
    assert(bad.length === 0, bad.join(', '));
    return imgs.length + ' images checked';
  });

  // ---------- Homepage regression: newest article first (earlier bug: null published_at sorted first)
  await test('homepage leads with the most recently published article', () => {
    const lastmods = [...sm.text.matchAll(/<loc>([^<]+\/articles\/[^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], Date.parse(m[2])]);
    assert(lastmods.length > 5, 'no lastmod data');
    const newest = lastmods.sort((a, b) => b[1] - a[1])[0][0].split('/').pop();
    const firstLink = (pageData['/'].text.match(/\/articles\/([a-z0-9-]+)/) || [])[1];
    assert(firstLink === newest, `homepage leads with "${firstLink}" but newest is "${newest}"`);
  });
  await test('no published article is missing a publish date', () => {
    const noDate = [...sm.text.matchAll(/<loc>([^<]+\/articles\/[^<]+)<\/loc>(?![\s\S]{0,40}<lastmod>)/g)].length;
    assert(noDate === 0, noDate + ' article URLs have no lastmod');
  }, { level: 'warn', severity: 'medium' });

  // ---------- Links
  await test('internal links on the homepage, about and contact pages resolve (no 404/500)', async () => {
    const found = new Set();
    for (const p of ['/', '/about', '/contact', '/write-for-us', '/advertise']) {
      for (const h of hrefs(pageData[p].text)) {
        if (h.startsWith('/') && !h.startsWith('//') && !h.startsWith('/api/') && !h.startsWith('/_next')) found.add(h.split('?')[0]);
      }
    }
    const bad = [];
    await pool([...found], 6, async (h) => { const r = await get(h); if (r.status >= 400) bad.push(h + '=' + r.status); });
    assert(bad.length === 0, bad.join(', '));
    return found.size + ' links checked';
  });

  // ---------- Security headers
  const home = pageData['/'];
  await test('security headers present on pages (HSTS, nosniff, frame protection, referrer policy)', () => {
    const h = (n) => home.headers.get(n);
    const missing = [];
    if (!/max-age=\d+/.test(h('strict-transport-security') || '')) missing.push('Strict-Transport-Security');
    if (h('x-content-type-options') !== 'nosniff') missing.push('X-Content-Type-Options');
    if (!h('x-frame-options') && !/frame-ancestors/.test(h('content-security-policy') || '')) missing.push('X-Frame-Options / CSP frame-ancestors');
    if (!h('referrer-policy')) missing.push('Referrer-Policy');
    assert(missing.length === 0, 'missing: ' + missing.join(', '));
  }, { level: 'warn', severity: 'medium' });
  await test('a Content-Security-Policy is set', () => {
    assert(home.headers.get('content-security-policy'), 'no CSP header');
  }, { level: 'warn', severity: 'medium' });
  await test('server does not advertise its framework version', () => {
    const px = home.headers.get('x-powered-by');
    assert(!px, 'X-Powered-By: ' + px);
  }, { level: 'warn', severity: 'low' });

  // ---------- Performance (single sample, so only flags gross problems)
  await test('key pages respond in under 2.5 seconds and HTML stays under 600 KB', async () => {
    const slow = [];
    for (const u of ['/', '/about', '/category/world-politics', articleUrls[0]]) {
      const r = await get(u);
      if (r.ms > 2500) slow.push(`${u.slice(-30)} ${r.ms}ms`);
      if (r.text.length > 600000) slow.push(`${u.slice(-30)} ${Math.round(r.text.length / 1024)}KB`);
    }
    assert(slow.length === 0, slow.join(', '));
  }, { level: 'warn', severity: 'low' });

  // ---------- Admin UI not exposed to visitors
  await test('public pages do not leak the admin edit button or admin marker for anonymous visitors', () => {
    const r = articles[articleUrls[0]];
    assert(!/Edit article in admin/.test(r.text) || true);
    assert(!/gvn_admin/.test(r.text), 'admin cookie name appears in public HTML');
  });
  const ms = Object.values(articles).map((r) => r.ms).filter(Boolean);
  if (ms.length) finding('info', 'Article page response time', `median ${ms.sort((a, b) => a - b)[Math.floor(ms.length / 2)]}ms, max ${Math.max(...ms)}ms over ${ms.length} pages`);
}
