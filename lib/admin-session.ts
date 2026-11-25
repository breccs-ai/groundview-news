import { createHash, createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed admin session tokens. Server-only (uses Node crypto).
 *
 * The admin cookie used to be the fixed text "authenticated", which anyone
 * could set in their own browser to be treated as an admin. A token is now
 * "<expiry unix seconds>.<HMAC-SHA256 signature>", signed with a key derived
 * from ADMIN_SESSION_SECRET (or, if that is not set, ADMIN_PASSWORD), so it
 * cannot be forged without the server's secret, expires on its own, and stops
 * working for everyone if the password or secret is changed.
 */

export const ADMIN_SESSION_SECONDS = 60 * 60 * 24;

function signingKey(): string | null {
  const base = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!base) return null;
  return createHash('sha256').update(`gvn-admin-session-v1:${base}`).digest('hex');
}

function sign(key: string, expiry: number): string {
  return createHmac('sha256', key).update(`admin:${expiry}`).digest('hex');
}

/** Returns null when no secret is configured, so callers fail closed. */
export function createAdminSessionToken(nowMs: number = Date.now()): string | null {
  const key = signingKey();
  if (!key) return null;
  const expiry = Math.floor(nowMs / 1000) + ADMIN_SESSION_SECONDS;
  return `${expiry}.${sign(key, expiry)}`;
}

export function verifyAdminSessionToken(token: string | undefined | null, nowMs: number = Date.now()): boolean {
  if (!token) return false;
  const key = signingKey();
  if (!key) return false;

  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const expiryText = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!/^\d{1,12}$/.test(expiryText) || !/^[0-9a-f]{64}$/i.test(signature)) return false;

  const expiry = Number(expiryText);
  if (expiry * 1000 < nowMs) return false;

  const expected = Buffer.from(sign(key, expiry), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Constant-time password comparison. */
export function adminPasswordMatches(candidate: string): boolean {
  const actual = process.env.ADMIN_PASSWORD;
  if (!actual || typeof candidate !== 'string') return false;
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(actual).digest();
  return timingSafeEqual(a, b);
}
