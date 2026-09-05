/**
 * Single source of truth for the branded email shell, signature, and legal
 * footer used across every outgoing email sent to an external recipient
 * (writers, subscribers, contact-form senders). Business identification
 * matches app/privacy-policy/page.tsx exactly, minus the registered office
 * address (omitted from emails by design — kept only on the legal pages).
 */

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

export const DEFAULT_EMAIL_SIGNATURE_HTML = `The Editor<br/>Continental View | Ground View News`;

function businessInfoHtml(): string {
  const site = siteUrl().replace(/^https?:\/\//, '');
  return `Ground View News is operated by <strong>Breccs Private Limited</strong> (trading as Ground View News), a company registered in England and Wales, company no. 15139888.
<br />${escapeHtml(site)} &middot; <a href="mailto:info@groundviewnews.com" style="color:#888;">info@groundviewnews.com</a> &middot; <a href="${siteUrl()}/privacy-policy" style="color:#888;">Privacy Policy</a>`;
}

/**
 * `footerExtra`, when given, renders above the standard business-info
 * footer — used for a category-specific data-protection disclaimer and/or
 * unsubscribe link (e.g. an optional reminder email, as opposed to an
 * essential account notification which carries no unsubscribe).
 */
export function emailShell(
  bodyHtml: string,
  options?: { footerExtra?: string; signatureHtml?: string }
): string {
  const signature = options?.signatureHtml ?? DEFAULT_EMAIL_SIGNATURE_HTML;
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
          ${signature}
        </p>
      </div>
      <div style="padding:14px 28px 22px 28px;border-top:1px solid #efeee9;font-size:11px;color:#888;font-family:Arial,Helvetica,sans-serif;line-height:1.6;text-align:center;">
        ${options?.footerExtra ? `<div style="margin-bottom:10px;">${options.footerExtra}</div>` : ''}
        ${businessInfoHtml()}
      </div>
    </div>
  </body>
</html>`;
}
