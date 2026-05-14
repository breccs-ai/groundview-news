import { cookies } from 'next/headers';
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from '@/lib/admin-auth';

export function isAdminServerSession(): boolean {
  return cookies().get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE;
}
