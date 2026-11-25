import { cookies } from 'next/headers';
import { ADMIN_COOKIE } from '@/lib/admin-auth';
import { verifyAdminSessionToken } from '@/lib/admin-session';

/** The one check every admin-only route uses. Fails closed if no secret is configured. */
export function isAdminServerSession(): boolean {
  return verifyAdminSessionToken(cookies().get(ADMIN_COOKIE)?.value);
}
