// Core logic: pure functions and email templates, loaded straight from the app's TypeScript.
import { createRequire } from 'node:module';
import { suite, test, assert } from '../framework.mjs';

const require = createRequire(import.meta.url);
const { createLoader } = require('../ts-loader.cjs');

export default async function run() {
  suite('Core logic (units)');
  const savedEnv = { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD, UNSUBSCRIBE_TOKEN_SECRET: process.env.UNSUBSCRIBE_TOKEN_SECRET, NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL };
  process.env.ADMIN_PASSWORD = 'unit-test-admin-password';
  process.env.UNSUBSCRIBE_TOKEN_SECRET = 'unit-test-unsubscribe-secret';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://groundviewnews.com';
  const load = createLoader();

  // ---- Advertising prices (the figures shown on /advertise and charged at checkout)
  const pricing = load('@/lib/advertiser/pricing');
  await test('annual price = 12 months less exactly 17.5% for every tier', () => {
    for (const [tier, monthly] of [['basic', 89], ['standard', 149], ['premium', 249]]) {
      const expected = Math.round(monthly * 12 * 0.825 * 100) / 100;
      assert(pricing.getAnnualPriceGbp(tier) === expected, `${tier}: ${pricing.getAnnualPriceGbp(tier)} !== ${expected}`);
      const saved = (monthly * 12 - pricing.getAnnualPriceGbp(tier)) / (monthly * 12);
      assert(Math.abs(saved - 0.175) < 0.0005, `${tier} saving ${(saved * 100).toFixed(3)}%`);
    }
    return 'Basic 881.10, Standard 1475.10, Premium 2465.10';
  });
  await test('monthly prices are 89 / 149 / 249', () => {
    assert(pricing.getMonthlyPriceGbp('basic') === 89 && pricing.getMonthlyPriceGbp('standard') === 149 && pricing.getMonthlyPriceGbp('premium') === 249);
  });
  await test('checkout amount matches the displayed price in pence (no float drift)', () => {
    for (const tier of ['basic', 'standard', 'premium']) {
      for (const cycle of ['monthly', 'annual']) {
        const price = pricing.getCheckoutPriceGbp(tier, cycle);
        const pence = Math.round(price * 100);
        assert(Number.isInteger(pence) && Math.abs(pence / 100 - price) < 1e-9, `${tier}/${cycle}: ${price}`);
      }
    }
  });
  await test('annual wording says "for 12 months, paid once" with two decimal places', () => {
    const l = pricing.getAnnualPriceLines('basic');
    assert(l.annualTotal === '£881.10 for 12 months, paid once', l.annualTotal);
    assert(l.savingsPercent === 17.5, String(l.savingsPercent));
  });
  const placements = load('@/lib/advertiser/placements');
  await test('placement tiers map to the right zones', () => {
    const e = placements.tierEligibleForZone;
    assert(e('premium', 'homepage_featured') && !e('standard', 'homepage_featured') && !e('basic', 'homepage_featured'));
    assert(e('standard', 'article_in_content') && e('premium', 'article_in_content') && !e('basic', 'article_in_content'));
    for (const t of ['basic', 'standard', 'premium']) assert(e(t, 'footer') && e(t, 'article_sidebar') && e(t, 'homepage_sidebar'));
  });

  // ---- Gambling ad detection
  const gambling = load('@/lib/advertiser/gambling');
  await test('gambling detector catches casino / betting / lottery / brand-domain ads', () => {
    const d = gambling.detectGamblingAd;
    assert(d({ title: 'Win big at Lucky Casino', bodyText: 'Free spins', destinationUrl: 'https://luckycasino.com' }).matched);
    assert(d({ title: 'Great odds', bodyText: '', destinationUrl: 'https://www.bet365.com/x' }).matched);
    assert(d({ title: 'Sports betting made easy', bodyText: '', destinationUrl: 'https://example.com' }).matched);
    assert(d({ title: 'Win the lottery jackpot', bodyText: '', destinationUrl: 'https://example.org' }).matched);
    assert(d({ title: 'Learn cards', bodyText: '', destinationUrl: 'https://pokerstars.com' }).matched);
  });
  await test('gambling detector leaves ordinary advertisers alone', () => {
    const d = gambling.detectGamblingAd;
    const clean = [
      { title: 'Book your holiday to Zimbabwe', bodyText: 'Better flights, alphabet tours', destinationUrl: 'https://7seasholidays.co.uk' },
      { title: 'Send money home fast', bodyText: 'Low fees, same-day', destinationUrl: 'https://wise.com' },
      { title: 'Support our stake in education', bodyText: 'Every pound helps', destinationUrl: 'https://savethechildren.org.uk' },
      { title: 'Specialist immigration advice', bodyText: 'Socialist-era records, replicate success', destinationUrl: 'https://example.co.uk' },
    ];
    for (const ad of clean) assert(!d(ad).matched, `false positive: ${ad.title}`);
  });

  // ---- Admin sessions (the fix for the forgeable admin cookie)
  const sess = load('@/lib/admin-session');
  await test('admin session: a freshly created token verifies', () => {
    const t = sess.createAdminSessionToken();
    assert(/^\d+\.[0-9a-f]{64}$/.test(t), 'token shape ' + t);
    assert(sess.verifyAdminSessionToken(t));
  });
  await test('admin session: the old forged value and junk are rejected', () => {
    for (const bad of ['authenticated', '', 'abc.def', '123.abc', undefined, null, '9999999999.' + 'a'.repeat(64)]) {
      assert(!sess.verifyAdminSessionToken(bad), `accepted ${String(bad)}`);
    }
  });
  await test('admin session: expired token rejected, tampered expiry rejected', () => {
    const t = sess.createAdminSessionToken(Date.now() - 2 * 24 * 3600 * 1000);
    assert(!sess.verifyAdminSessionToken(t), 'expired token accepted');
    const good = sess.createAdminSessionToken();
    const [exp, sig] = good.split('.');
    assert(!sess.verifyAdminSessionToken(`${Number(exp) + 100000}.${sig}`), 'tampered expiry accepted');
  });
  await test('admin session: fails closed when no secret is configured', () => {
    const saved = [process.env.ADMIN_PASSWORD, process.env.ADMIN_SESSION_SECRET];
    const t = sess.createAdminSessionToken();
    delete process.env.ADMIN_PASSWORD; delete process.env.ADMIN_SESSION_SECRET;
    const ok = sess.verifyAdminSessionToken(t) || sess.createAdminSessionToken() !== null;
    process.env.ADMIN_PASSWORD = saved[0]; if (saved[1]) process.env.ADMIN_SESSION_SECRET = saved[1];
    assert(!ok, 'token accepted or created with no secret');
  });
  await test('admin session: a token stops working if the password changes', () => {
    const t = sess.createAdminSessionToken();
    process.env.ADMIN_PASSWORD = 'a-different-password';
    const stillValid = sess.verifyAdminSessionToken(t);
    process.env.ADMIN_PASSWORD = 'unit-test-admin-password';
    assert(!stillValid, 'old token survived a password change');
  });
  await test('admin password check: correct accepted, wrong/empty/odd rejected', () => {
    assert(sess.adminPasswordMatches('unit-test-admin-password'));
    for (const bad of ['', 'wrong', 'unit-test-admin-password ', 'UNIT-TEST-ADMIN-PASSWORD', null, undefined, 123]) {
      assert(!sess.adminPasswordMatches(bad), `accepted ${String(bad)}`);
    }
  });

  // ---- Unsubscribe tokens
  const unsub = load('@/lib/unsubscribe-token');
  await test('unsubscribe token: round-trips and rejects another id/email or junk', () => {
    const t = unsub.signUnsubscribeToken('person@example.com');
    assert(unsub.verifyUnsubscribeToken('person@example.com', t));
    assert(!unsub.verifyUnsubscribeToken('other@example.com', t));
    for (const bad of ['', 'deadbeef', 'z'.repeat(64), t.slice(0, 63)]) assert(!unsub.verifyUnsubscribeToken('person@example.com', bad));
  });

  // ---- Editorial routing
  const ed = load('@/lib/editorial-category');
  await test('editorial routing: sensitive categories need a human, others do not', () => {
    for (const c of ['political-commentary', 'human-rights-reporting', 'conflict-reporting']) assert(ed.requiresHumanEditorialReview(c), c);
    for (const c of ['general', 'culture', 'economy']) assert(!ed.requiresHumanEditorialReview(c), c);
    assert(ed.normalizeEditorialCategory('nonsense') === 'general' && ed.normalizeEditorialCategory(undefined) === 'general');
  });

  // ---- Slugs
  const slug = load('@/lib/slug');
  await test('slugs: lowercase, hyphenated, punctuation removed, collapsed spaces', () => {
    assert(slug.generateSlug("Hello, World! It's 2026") === 'hello-world-its-2026');
    assert(slug.generateSlug('  Multiple   spaces -- here ') === 'multiple-spaces-here');
    assert(/^article-[a-z0-9]{1,4}$/.test(slug.generateUniqueSlug('!!!')));
    assert(slug.generateSlug('Zimbabwe '.repeat(30)).length <= 96, 'long multi-word titles are capped');
  });
  await test('slugs: accented letters are transliterated, not dropped (Cote dIvoire, Senegal, Sao Tome)', () => {
    const bad = ["Côte d'Ivoire", 'Sénégal', 'São Tomé', 'Café Résumé'].map((t) => [t, slug.generateSlug(t)]).filter(([t, g]) => !/cote|senegal|sao-tome|cafe-resume/.test(g));
    assert(bad.length === 0, 'mangled: ' + bad.map(([t, g]) => t + ' -> ' + g).join(' | '));
  }, { level: 'warn', severity: 'medium' });
  await test('slugs: a title with no Latin letters does not produce a "-" slug', () => {
    const g = slug.generateSlug('Мир и война');
    assert(g !== '-' && g.length > 1, 'slug was ' + JSON.stringify(g));
  }, { level: 'warn', severity: 'low' });
  await test('slugs: one very long word is still capped at 96 characters', () => {
    const g = slug.generateSlug('A'.repeat(200) + ' word');
    assert(g.length <= 96, g.length + ' characters');
  }, { level: 'warn', severity: 'low' });

  // ---- Reader subscription expiry
  const sub = load('@/lib/subscription');
  await test('subscriptions: active only if status active and not expired', () => {
    assert(!sub.isActiveSubscriber(null));
    assert(sub.isActiveSubscriber({ subscription_status: 'active', subscription_expires_at: new Date(Date.now() + 86400000).toISOString() }));
    assert(!sub.isActiveSubscriber({ subscription_status: 'active', subscription_expires_at: new Date(Date.now() - 86400000).toISOString() }));
    assert(!sub.isActiveSubscriber({ subscription_status: 'cancelled', subscription_expires_at: null }));
    assert(!sub.isActiveSubscriber({ subscription_status: 'past_due', subscription_expires_at: null }));
  });
  await test('subscriptions: monthly and annual expiry dates', () => {
    const from = new Date(Date.UTC(2026, 0, 31, 12));
    const m = sub.computeExpiry('monthly', from);
    const a = sub.computeExpiry('annual', new Date(Date.UTC(2026, 5, 15)));
    assert(a.getUTCFullYear() === 2027 && a.getUTCMonth() === 5 && a.getUTCDate() === 15, a.toISOString());
    // Known JS rollover: 31 Jan + 1 month lands in March. Record it rather than hide it.
    return 'monthly from 31 Jan -> ' + m.toISOString().slice(0, 10);
  });

  // ---- Anti-spam validation must not reject real people
  const spam = load('@/lib/contact-spam-validation');
  const realNames = ['Jane Smith', 'Chrispen Nkosi', 'Takudzwa Taruvinga', 'Mhuka Felix', 'Michael Maburutse', 'Leonid Pasternak', 'Ncube', 'Ndlovu', 'Mthethwa', 'Nkrumah', 'Mngadi', 'Ngwenya', 'Dlamini', 'Mpofu', 'Nyathi', 'Mbeki', 'Kgosana', 'Nxumalo', 'Ntshangase', 'Chukwuemeka Okafor', 'Wanjiru Kamau', "O'Brien", 'Zhang Wei', 'Nhlanhla Sibanda', 'Bhebhe', 'Gwenzi', 'Mnangagwa', 'Mkhwanazi', 'Thandiwe Mthembu'];
  await test('anti-spam name check accepts real African, Irish, Chinese and Slavic names', () => {
    const rejected = realNames.filter((n) => !spam.isPlausibleName(n));
    assert(rejected.length === 0, 'wrongly rejected: ' + rejected.join(', '));
    return `${realNames.length} names accepted`;
  }, { level: 'warn' });
  await test('anti-spam rejects the documented bot pattern (random-case tokens), vowelless filler and bad emails', () => {
    for (const g of ['QnBnyfKwJCFIKIJk', 'xkcdqwrtz', 'zxcvbnmqwrt', 'qqqq wwww', 'Hjkl Mnbv', '12345']) assert(!spam.isPlausibleName(g), 'accepted: ' + g);
    for (const e of ['not-an-email', 'a@b', '@x.com', 'a b@c.com']) assert(!spam.isValidEmailFormat(e), 'accepted ' + e);
    assert(spam.isValidEmailFormat('someone@example.co.uk'));
  });
  await test('anti-spam heuristic gaps: keyboard-mash and digit-mixed tokens are accepted as names', () => {
    const slipped = ['asdkjhqwe', 'aB3xK9qLm2Zp', 'John123abc'].filter((g) => spam.isPlausibleName(g));
    assert(slipped.length === 0, 'accepted as valid names: ' + slipped.join(', '));
  }, { level: 'warn', severity: 'low' });

  // ---- Article diff (feedback workflow)
  const diff = load('@/lib/article-diff');
  await test('article diff: counts added links, edits and additions; identical text has no changes', () => {
    const before = { title: 't', subtitle: '', excerpt: '', markdown: 'One claim here.\n\nTwo claim here.\n\nThree.' };
    const after = { ...before, markdown: 'One claim here (source https://a.org/x).\n\nTwo claim here.\n\nThree.\n\nFour with https://b.org/y.' };
    const d = diff.diffArticle(before, after);
    assert(d.stats.linksBefore === 0 && d.stats.linksAfter === 2, JSON.stringify(d.stats));
    assert(d.stats.paragraphsModified === 1 && d.stats.paragraphsAdded === 1, JSON.stringify(d.stats));
    assert(!diff.diffArticle(before, before).hasChanges);
  });
  await test('article diff: HTML in article text is escaped in the email', () => {
    const d = diff.diffArticle({ title: 't', subtitle: '', excerpt: '', markdown: 'a\n\nb' }, { title: 't', subtitle: '', excerpt: '', markdown: 'a\n\n<script>alert(1)</script>' });
    const html = diff.renderDiffHtml(d);
    assert(!/<script/i.test(html) && /&lt;script/.test(html));
  });

  // ---- Email templates
  const writer = load('@/lib/writer-emails');
  const cold = load('@/lib/cold-outreach-emails');
  const feedback = load('@/lib/article-feedback');
  const evil = '<img src=x onerror=alert(1)> & "quotes"';
  await test('writer emails: escape hostile names/titles, contain no "undefined", keep links', () => {
    const e = writer.articleChangesRequestedEmail({ fullName: evil, articleTitle: evil, items: [evil, 'Add sources'], note: evil, editUrl: 'https://groundviewnews.com/journalists/submit?id=1' });
    assert(!/<img src=x/i.test(e.html), 'unescaped HTML');
    assert(!/undefined|\[object/.test(e.html + e.subject), 'undefined in output');
    assert(e.html.includes('https://groundviewnews.com/journalists/submit?id=1') && e.html.includes('/editorial-policy'));
    const a = writer.articleApprovedForPublishEmail({ fullName: 'Ada', articleTitle: 'T', articleEditUrl: 'https://x.test' });
    assert(!/undefined/.test(a.html) && a.subject.length > 5);
  });
  await test('cold-outreach email: working unsubscribe link, one-click headers, legal footer, no "undefined"', () => {
    const m = cold.coldOutreachIntroEmail({ organisationName: evil, email: 'Info@Example.org ' });
    assert(!/undefined/.test(m.html) && !/<img src=x/i.test(m.html), 'bad html');
    const url = cold.coldOutreachUnsubscribeUrl('Info@Example.org ');
    const u = new URL(url);
    assert(u.pathname === '/api/outreach/unsubscribe' && u.searchParams.get('email') === 'info@example.org', url);
    assert(unsub.verifyUnsubscribeToken('info@example.org', u.searchParams.get('token')), 'link token does not verify');
    assert(/List-Unsubscribe/.test(Object.keys(m.headers).join()) && m.headers['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click');
    assert(/Breccs Private Limited/.test(m.html) && /legitimate interests/.test(m.html));
  });
  await test('resubmission email: shows link counts and escapes content', () => {
    const d = diff.diffArticle({ title: 't', subtitle: '', excerpt: '', markdown: 'a' }, { title: 't', subtitle: '', excerpt: '', markdown: 'a\n\nsee https://x.org/y' });
    const m = feedback.resubmissionNotificationHtml({ articleId: 'id1', articleTitle: evil, writerName: evil, round: 2, items: ['Add sources'], diff: d });
    assert(/round 2/.test(m.subject) && /1 link added/.test(m.bodyHtml) && !/<img src=x/i.test(m.bodyHtml));
  });
  for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
}
