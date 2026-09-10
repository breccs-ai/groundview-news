/**
 * Branded HTML template for the first-touch cold-outreach campaign.
 * The shell/signature/footer live in lib/email-branding.ts and are shared with
 * every other outgoing email — do not redefine them here. The unsubscribe
 * token reuses the same HMAC scheme as writer reminder emails
 * (lib/unsubscribe-token.ts), signed against the recipient's email address
 * instead of a profile id, since cold-outreach recipients have no account.
 */
import { signUnsubscribeToken } from '@/lib/unsubscribe-token';
import { emailShell, escapeHtml, siteUrl } from '@/lib/email-branding';

export { siteUrl, escapeHtml };

export const OUTREACH_EMAIL_FROM = 'Ground View News <info@groundviewnews.com>';

function shell(bodyHtml: string, footerExtra?: string): string {
  return emailShell(bodyHtml, { footerExtra });
}

export function coldOutreachUnsubscribeUrl(email: string): string {
  const normalized = email.trim().toLowerCase();
  return `${siteUrl()}/api/outreach/unsubscribe?email=${encodeURIComponent(normalized)}&token=${signUnsubscribeToken(normalized)}`;
}

export function coldOutreachIntroEmail(args: { organisationName: string; email: string }): {
  subject: string;
  html: string;
  headers: Record<string, string>;
} {
  const org = String(args.organisationName || '').trim() || 'your organisation';
  const subject = 'A quick introduction from Ground View News';
  const unsubscribeUrl = coldOutreachUnsubscribeUrl(args.email);

  const html = shell(
    `<p>Hi ${escapeHtml(org)} team,</p>
<p>I'm reaching out from Ground View News, an independent publication covering global affairs, business, and the stories shaping communities across the UK, Ireland, and beyond.</p>
<p>We're building relationships with organisations like yours — whether that's exploring advertising with us, a content or distribution partnership, or simply making sure ${escapeHtml(org)} is on our radar as we grow.</p>
<p>If any of that sounds useful, I'd welcome a short reply or a quick 15-minute call to see where it might make sense.</p>
<p>Thanks for your time — and either way, you're welcome to read our latest coverage at <a href="${siteUrl()}" style="color:#0f1f3d;">groundviewnews.com</a>.</p>`,
    `This is a one-time introduction sent to a publicly listed organisational contact address, on the basis of our legitimate interests in reaching organisations relevant to Ground View News (UK/EU GDPR Art. 6(1)(f) or the equivalent basis where you are located). It is not a subscription, and no further emails will follow unless you respond.
<br /><a href="${escapeHtml(unsubscribeUrl)}" style="color:#888;">Unsubscribe — do not contact again</a>`
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
