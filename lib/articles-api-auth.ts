import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, User } from '@supabase/supabase-js';

const ADMIN_COOKIE = 'gvn_admin_session';
const ADMIN_COOKIE_VALUE = 'authenticated';

export type ArticlesApiActor =
  | { kind: 'admin' }
  | { kind: 'journalist'; user: User; accessToken: string };

function isAdminCookie(): boolean {
  const cookie = cookies().get(ADMIN_COOKIE);
  return cookie?.value === ADMIN_COOKIE_VALUE;
}

export async function resolveArticlesActor(req: NextRequest): Promise<ArticlesApiActor | null> {
  if (isAdminCookie()) {
    return { kind: 'admin' };
  }

  const auth = req.headers.get('authorization');
  const token =
    auth && auth.startsWith('Bearer ')
      ? auth.slice(7).trim()
      : null;

  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return { kind: 'journalist', user: data.user, accessToken: token };
}
