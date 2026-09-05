import { createHmac, timingSafeEqual } from 'crypto';

// Lets an unsubscribe link authenticate a single profile without login: the
// token is an HMAC of the profile id, so it can be verified on click but not
// forged or guessed for a different profile.
function secret(): string {
  return (
    process.env.UNSUBSCRIBE_TOKEN_SECRET ||
    process.env.WRITER_RATE_LIMIT_SECRET ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'ground-view-unsubscribe-token'
  );
}

export function signUnsubscribeToken(profileId: string): string {
  return createHmac('sha256', secret()).update(profileId).digest('hex');
}

export function verifyUnsubscribeToken(profileId: string, token: string): boolean {
  if (!profileId || !token || token.length !== 64 || !/^[0-9a-f]+$/i.test(token)) return false;
  const expected = signUnsubscribeToken(profileId);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(token, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
