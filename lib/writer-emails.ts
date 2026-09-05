/**
 * Branded HTML email templates for the writer onboarding system.
 * All writer-facing emails are signed "The Editor, Continental View | Ground View News".
 * The shell/signature/footer live in lib/email-branding.ts and are shared with
 * every other outgoing email — do not redefine them here.
 */
import { signUnsubscribeToken } from '@/lib/unsubscribe-token';
import { emailShell, escapeHtml, siteUrl } from '@/lib/email-branding';

export { siteUrl, escapeHtml };

export const WRITER_EMAIL_FROM = 'Ground View News <info@groundviewnews.com>';

function firstName(fullName: string): string {
  const trimmed = String(fullName || '').trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

function shell(bodyHtml: string, footerExtra?: string): string {
  return emailShell(bodyHtml, { footerExtra });
}

// ──────────────────────────────────────────────────────────────────────────
// Writer-facing templates
// ──────────────────────────────────────────────────────────────────────────

export function applicationReceivedEmail(args: { fullName: string }): {
  subject: string;
  html: string;
} {
  const subject = 'We have received your application — Ground View News';
  const html = shell(`
    <p>Hi ${escapeHtml(firstName(args.fullName))},</p>
    <p>Thank you for applying to write for <strong>Ground View News</strong>. Your application has been received and is now with our editorial team.</p>
    <p>We aim to review every application within <strong>24 hours</strong>. You will receive another email from us shortly with our decision.</p>
    <p>If you have any questions in the meantime, simply reply to this message.</p>
  `);
  return { subject, html };
}

export function applicationApprovedEmail(args: {
  fullName: string;
  penName: string;
}): { subject: string; html: string } {
  const subject = 'You are approved — start writing for Ground View News';
  const dashboardUrl = `${siteUrl()}/journalists/dashboard`;
  const html = shell(`
    <p>Congratulations ${escapeHtml(firstName(args.fullName))},</p>
    <p>Your application has been <strong>approved</strong>. You are now a contributor for Ground View News.</p>
    <p>Your articles will be published under the name: <strong>${escapeHtml(args.penName)}</strong>.</p>
    <p style="margin-top:24px;">
      <a
        href="${escapeHtml(dashboardUrl)}"
        style="display:inline-block;background:#0f1f3d;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;"
      >Open your writer dashboard</a>
    </p>
    <p style="margin-top:24px;">Here is how publishing works on Ground View News:</p>
    <ol style="margin:8px 0 0 20px;padding:0;">
      <li style="margin-bottom:6px;"><strong>Draft</strong> your article in the editor.</li>
      <li style="margin-bottom:6px;"><strong>Submit</strong> it for review.</li>
      <li style="margin-bottom:6px;">Our editors review it. If approved, you will receive an email from us.</li>
      <li style="margin-bottom:6px;">You then <strong>click Publish</strong> from your dashboard to take it live.</li>
    </ol>
    <p><strong>How writer earnings work:</strong> Ground View News maintains a writer share pool funded from net advertising revenue. Your share is based on meaningful reader engagement with your published articles, so earnings vary with advertising income and article performance and are not guaranteed.</p>
    <p>Your dashboard shows your monthly earnings, available balance, payment requests, and payout instructions. You can choose bank transfer, Wise, PayPal, mobile money, another remittance service, or describe another suitable method. We never require you to have a Stripe account.</p>
    <p>Our first priority is thoughtful, credible journalism. If you are proud of an article, you are welcome to share it with your community. You may also introduce appropriate advertising partners, but neither activity is required and neither affects editorial decisions.</p>
    <p>We are looking forward to reading your work and building Ground View News together.</p>
  `);
  return { subject, html };
}

export function applicationRejectedEmail(args: { fullName: string }): {
  subject: string;
  html: string;
} {
  const subject = 'Your Ground View News application';
  const html = shell(`
    <p>Hi ${escapeHtml(firstName(args.fullName))},</p>
    <p>Thank you for applying to write for Ground View News and for taking the time to share your background with us.</p>
    <p>After careful review, we are unfortunately unable to move forward with your application at this time.</p>
    <p>We genuinely encourage you to reapply in future — our editorial needs evolve, and we would be glad to consider you again.</p>
  `);
  return { subject, html };
}

export function articleApprovedForPublishEmail(args: {
  fullName: string;
  articleTitle: string;
  articleEditUrl: string;
}): { subject: string; html: string } {
  const subject = 'Your article has been approved — ready to publish';
  const html = shell(`
    <p>Hi ${escapeHtml(firstName(args.fullName))},</p>
    <p>Good news — your article <strong>${escapeHtml(args.articleTitle)}</strong> has been approved by our editorial team.</p>
    <p>It is now waiting for you in your writer dashboard with a <strong>Publish Now</strong> button.</p>
    <p style="margin-top:20px;">
      <a
        href="${escapeHtml(args.articleEditUrl)}"
        style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;"
      >Open the dashboard</a>
    </p>
    <p>Your article will go live the moment you click Publish.</p>
  `);
  return { subject, html };
}

export function writerActivityReminderEmail(args: { id: string; fullName: string }): {
  subject: string;
  html: string;
  headers: Record<string, string>;
} {
  const subject = 'Log in and publish — plus how your earnings grow';
  const dashboardUrl = `${siteUrl()}/journalists/dashboard`;
  const unsubscribeUrl = `${siteUrl()}/api/journalists/unsubscribe-reminders?id=${encodeURIComponent(args.id)}&token=${signUnsubscribeToken(args.id)}`;
  const html = shell(`
    <p>Hi ${escapeHtml(firstName(args.fullName))},</p>
    <p>A quick reminder to log in and publish as news breaks — timely coverage is what keeps readers coming back, and your dashboard is ready whenever a story is.</p>
    <p style="margin-top:20px;">
      <a
        href="${escapeHtml(dashboardUrl)}"
        style="display:inline-block;background:#0f1f3d;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;"
      >Open your writer dashboard</a>
    </p>
    <p style="margin-top:24px;"><strong>How that connects to your earnings:</strong> Ground View News shares a percentage of net advertising revenue with writers each month. Your share of that pool is based on real reader engagement with your published articles — not just raw views, but how long readers stay and how far they read. The more readers your work reaches and holds, the larger your share of that month's pool.</p>
    <p>If you're proud of a piece, sharing it with your own network directly grows that engagement — every reader who clicks through and stays counts toward your earnings on that article. This is entirely optional and never affects editorial decisions.</p>
    <p>Writers who publish five qualifying articles also become eligible for the Founding Lead Editor programme — an optional role for our first ten members that adds a small earnings weighting on top of the standard share.</p>
    <p>Your dashboard shows your running monthly statement and payout options (bank transfer, Wise, PayPal, mobile money, or another method that works for you). As always, earnings vary with advertising income and article performance and are not guaranteed.</p>
    <p>We'd love to see fresh coverage from you this week.</p>
  `, `
    You're receiving this because you hold an active writer account with Ground View News (${escapeHtml(siteUrl().replace(/^https?:\/\//, ''))}) and this is an occasional activity and earnings reminder for approved writers — not a required account notification.
    <br /><a href="${escapeHtml(unsubscribeUrl)}" style="color:#888;">Unsubscribe from these reminders</a> — you will still receive essential account emails (application decisions, article approvals, and payment statements), which aren't optional.
  `);
  return {
    subject,
    html,
    headers: {
      'List-Unsubscribe': `<mailto:info@groundviewnews.com?subject=unsubscribe>, <${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

export type DigestArticle = { title: string; url: string; authorName: string };

/**
 * Shared by the one-off "latest story" send and the recurring weekly digest —
 * `periodLabel` and `articles` are the only difference between the two. Each
 * recipient's own articles are filtered out by the caller before this runs,
 * so nobody is told to go share their own piece.
 */
export function articleDigestEmail(args: {
  id: string;
  fullName: string;
  periodLabel: string;
  articles: DigestArticle[];
}): { subject: string; html: string; headers: Record<string, string> } {
  const subject =
    args.articles.length === 1
      ? `New on Ground View News: ${args.articles[0].title}`
      : `${args.periodLabel}: ${args.articles.length} new stories from Ground View News`;
  const unsubscribeUrl = `${siteUrl()}/api/journalists/unsubscribe-reminders?id=${encodeURIComponent(args.id)}&token=${signUnsubscribeToken(args.id)}`;

  const list = args.articles
    .map(
      (a) =>
        `<li style="margin-bottom:10px;"><a href="${escapeHtml(a.url)}" style="color:#0f1f3d;"><strong>${escapeHtml(a.title)}</strong></a><br/><span style="color:#666;font-size:13px;">by ${escapeHtml(a.authorName)}</span></li>`
    )
    .join('');

  const html = shell(
    `<p>Hi ${escapeHtml(firstName(args.fullName))},</p>
<p>${escapeHtml(args.periodLabel)} on Ground View News:</p>
<ul style="padding-left:20px;margin:16px 0;">${list}</ul>
<p>If any of these resonate, sharing them with your own network helps grow readership for everyone — and every reader who clicks through and stays counts toward that writer's earnings on the piece.</p>`,
    `You're receiving this because you hold an active writer account with Ground View News and this is an occasional roundup of colleagues' published work — not a required account notification.
<br /><a href="${escapeHtml(unsubscribeUrl)}" style="color:#888;">Unsubscribe from these emails</a> — you will still receive essential account emails (application decisions, article approvals, and payment statements), which aren't optional.`
  );

  return {
    subject,
    html,
    headers: {
      'List-Unsubscribe': `<mailto:info@groundviewnews.com?subject=unsubscribe>, <${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Admin-facing templates
// ──────────────────────────────────────────────────────────────────────────

export function adminFeedbackEmail(args: {
  fullName: string;
  penName: string;
  email: string;
  subject: string;
  message: string;
  rating: number;
}): { subject: string; html: string } {
  const subject = `Writer feedback: ${args.subject}`;
  const html = shell(`
      <h2 style="margin:0 0 12px;">Writer feedback received</h2>
      <p style="margin:0 0 6px;"><strong>Writer:</strong> ${escapeHtml(args.fullName)} (${escapeHtml(args.penName || '—')})</p>
      <p style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(args.email)}</p>
      <p style="margin:0 0 6px;"><strong>Rating:</strong> ${args.rating} / 5</p>
      <p style="margin:0 0 6px;"><strong>Subject:</strong> ${escapeHtml(args.subject)}</p>
      <hr style="margin:14px 0;border:none;border-top:1px solid #e5e5e5;" />
      <p style="white-space:pre-wrap;margin:0;">${escapeHtml(args.message)}</p>
  `);
  return { subject, html };
}
