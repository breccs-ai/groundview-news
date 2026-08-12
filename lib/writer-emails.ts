/**
 * Branded HTML email templates for the writer onboarding system.
 * All writer-facing emails are signed "The Editor, Continental View | Ground View News".
 */

const EDITOR_SIGNATURE = `The Editor<br/>Continental View | Ground View News`;

export const WRITER_EMAIL_FROM = 'Ground View News <info@groundviewnews.com>';

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://groundviewnews.com').replace(/\/$/, '');
}

export function escapeHtml(input: string): string {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function firstName(fullName: string): string {
  const trimmed = String(fullName || '').trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

function shell(bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background-color:#f6f6f4;font-family:Georgia,'Playfair Display',serif;color:#1a1a1a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e7e3;border-radius:4px;overflow:hidden;">
      <div style="background:#0f1f3d;padding:18px 24px;">
        <p style="margin:0;font-size:20px;font-weight:bold;color:#ffffff;font-family:Georgia,'Playfair Display',serif;">
          Ground View <span style="color:#d4a017;">News</span>
        </p>
      </div>
      <div style="padding:28px 28px 8px 28px;font-size:15px;line-height:1.6;color:#1f1f1f;">
        ${bodyHtml}
        <p style="margin-top:28px;color:#555;">
          Warm regards,<br/>
          ${EDITOR_SIGNATURE}
        </p>
      </div>
      <div style="padding:14px 28px 22px 28px;border-top:1px solid #efeee9;font-size:11px;color:#888;font-family:Arial,Helvetica,sans-serif;">
        Continental View | Ground View News &middot; ${escapeHtml(siteUrl().replace(/^https?:\/\//, ''))}
      </div>
    </div>
  </body>
</html>`;
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
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height:1.5;">
      <h2 style="margin:0 0 12px;">Writer feedback received</h2>
      <p style="margin:0 0 6px;"><strong>Writer:</strong> ${escapeHtml(args.fullName)} (${escapeHtml(args.penName || '—')})</p>
      <p style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(args.email)}</p>
      <p style="margin:0 0 6px;"><strong>Rating:</strong> ${args.rating} / 5</p>
      <p style="margin:0 0 6px;"><strong>Subject:</strong> ${escapeHtml(args.subject)}</p>
      <hr style="margin:14px 0;border:none;border-top:1px solid #e5e5e5;" />
      <p style="white-space:pre-wrap;margin:0;">${escapeHtml(args.message)}</p>
    </div>
  `.trim();
  return { subject, html };
}
