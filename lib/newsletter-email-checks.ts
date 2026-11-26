// Cheap checks that keep throwaway and machine-generated addresses off the newsletter
// form before we spend a confirmation email on them.

// Well-known disposable and temporary-inbox providers. Not exhaustive: it only needs to
// catch the common ones, since the honeypot, name checks and rate limits cover the rest.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com',
  'sharklasers.com', 'grr.la', 'spam4.me', '10minutemail.com', '10minutemail.net', '20minutemail.com',
  'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmailo.com', 'tempail.com', 'tempinbox.com',
  'throwawaymail.com', 'trashmail.com', 'trashmail.net', 'trashmail.de', 'yopmail.com', 'yopmail.net',
  'yopmail.fr', 'getnada.com', 'nada.email', 'dispostable.com', 'maildrop.cc', 'mailnesia.com',
  'mintemail.com', 'mohmal.com', 'emailondeck.com', 'fakeinbox.com', 'fakemail.net', 'mytemp.email',
  'burnermail.io', 'discard.email', 'discardmail.com', 'spamgourmet.com', 'moakt.com', 'mail.tm',
  'inboxkitten.com', 'harakirimail.com', 'mailcatch.com', 'mailsac.com', 'tmail.ws', 'tmpmail.org',
  'tmpmail.net', 'dropmail.me', 'emltmp.com', 'getairmail.com', 'anonbox.net', 'owlymail.com',
  'tempr.email', 'luxusmail.org', 'cuvox.de', 'einrot.com', 'gustr.com', 'jourrapide.com',
]);

export function isDisposableEmailDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] || '';
  if (!domain) return false;
  // Match the domain itself and any subdomain of it (e.g. x.mailinator.com).
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}

/**
 * Gmail ignores dots in the local part, so bots pad one inbox into endless "different"
 * addresses (kl.i.nema.s.a@gmail.com). Real people use one or two dots at most
 * (first.last, first.m.last), so four or more is treated as generated.
 */
export function looksLikeDotPaddedGmail(email: string): boolean {
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (!local || (domain !== 'gmail.com' && domain !== 'googlemail.com')) return false;
  return (local.match(/\./g) || []).length >= 4;
}

export function isSuspiciousNewsletterEmail(email: string): boolean {
  return isDisposableEmailDomain(email) || looksLikeDotPaddedGmail(email);
}
