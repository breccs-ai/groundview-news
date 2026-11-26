import { emailShell, escapeHtml, siteUrl } from '@/lib/email-branding';
import { newsletterLink } from '@/lib/newsletter-tokens';

export const NEWSLETTER_FROM = 'Ground View News <info@groundviewnews.com>';
export const DIGEST_SUBJECT = "Ground View News — This Week's Top Stories";
const DIGEST_SIGNATURE = 'The Editor, Continental View | Ground View News';

/** Headers that give mail clients a one-click unsubscribe (RFC 8058). */
export function unsubscribeHeaders(email: string): Record<string, string> {
  const url = newsletterLink('unsubscribe', email);
  return {
    'List-Unsubscribe': `<mailto:info@groundviewnews.com?subject=unsubscribe>, <${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/** Double opt-in: nothing is sent to an address until its owner clicks this. */
export function newsletterConfirmationEmail(email: string, firstName: string): { subject: string; html: string } {
  const url = newsletterLink('confirm', email);
  const name = firstName.trim() ? ` ${escapeHtml(firstName.trim())}` : '';
  return {
    subject: 'Confirm your Ground View News subscription',
    html: emailShell(
      `<p>Hello${name},</p>
<p>Someone, hopefully you, asked to receive the Ground View News weekly newsletter at this address. To start receiving it, please confirm:</p>
<p style="margin:24px 0;"><a href="${escapeHtml(url)}" style="background:#0f1f3d;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:15px;display:inline-block;">Confirm my subscription</a></p>
<p>If you did not sign up, ignore this email and you will not hear from us again.</p>`,
      {
        footerExtra:
          'You received this one-time email because this address was entered on the Ground View News newsletter form at groundviewnews.com. You will not be subscribed unless you confirm.',
      }
    ),
  };
}

export type DigestArticle = {
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
};

function articleCardHtml(a: DigestArticle): string {
  const title = escapeHtml(a.title || 'Untitled');
  const category = a.category ? escapeHtml(a.category) : '';
  const excerpt = a.excerpt ? escapeHtml(a.excerpt) : '';
  const href = `${siteUrl()}/articles/${encodeURIComponent(a.slug)}`;
  return `
<tr><td style="padding:18px 0;border-bottom:1px solid #eee;">
  ${category ? `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#b8860b;margin-bottom:6px;">${category}</div>` : ''}
  <a href="${href}" style="color:#0f1f3d;text-decoration:none;font-family:Georgia,serif;font-size:18px;font-weight:700;line-height:1.3;display:block;margin-bottom:6px;">${title}</a>
  ${excerpt ? `<p style="margin:0 0 8px 0;color:#444;font-family:Georgia,serif;font-size:14px;line-height:1.6;">${excerpt}</p>` : ''}
  <a href="${href}" style="color:#b8860b;text-decoration:none;font-size:13px;font-weight:600;">Read more →</a>
</td></tr>`;
}

/** The weekly digest for one recipient; the unsubscribe link is personal to them. */
export function weeklyDigestHtml(articles: DigestArticle[], recipientEmail: string): string {
  const unsubscribeUrl = newsletterLink('unsubscribe', recipientEmail);
  const cards = articles.map(articleCardHtml).join('\n');
  return `<!DOCTYPE html>
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
          <p style="margin:0 0 6px 0;font-family:Inter,Arial,sans-serif;font-size:13px;color:#333;">${escapeHtml(DIGEST_SIGNATURE)}</p>
          <p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:11px;color:#999;">
            You're receiving this email because you subscribed at <a href="${siteUrl()}" style="color:#999;">groundviewnews.com</a>.
            <a href="${escapeHtml(unsubscribeUrl)}" style="color:#999;">Unsubscribe</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
