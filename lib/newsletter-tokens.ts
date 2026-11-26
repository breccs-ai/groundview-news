import { signUnsubscribeToken, verifyUnsubscribeToken } from '@/lib/unsubscribe-token';
import { siteUrl } from '@/lib/email-branding';

// Signed links for the newsletter, one purpose each so a confirm link can never be
// replayed as an unsubscribe link (or the reverse). Both are HMACs of the address,
// so they can be checked on click without a database lookup and cannot be forged
// or guessed for a different address.
export type NewsletterLinkKind = 'confirm' | 'unsubscribe';

const scope = (kind: NewsletterLinkKind, email: string) =>
  `newsletter:${kind}:${email.trim().toLowerCase()}`;

export function signNewsletterToken(kind: NewsletterLinkKind, email: string): string {
  return signUnsubscribeToken(scope(kind, email));
}

export function verifyNewsletterToken(kind: NewsletterLinkKind, email: string, token: string): boolean {
  return verifyUnsubscribeToken(scope(kind, email), token);
}

export function newsletterLink(kind: NewsletterLinkKind, email: string): string {
  const e = email.trim().toLowerCase();
  return `${siteUrl()}/api/newsletter/${kind}?email=${encodeURIComponent(e)}&token=${signNewsletterToken(kind, e)}`;
}
