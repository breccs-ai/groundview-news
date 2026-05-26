import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase-service';
import { getReaderSubscriptionByUserId, isActiveSubscriber } from '@/lib/subscription';

export const runtime = 'nodejs';

/**
 * GET /api/me/subscription
 *
 * Called by SubscriptionProvider on every page load to decide whether the
 * reader is an active subscriber. Bearer-token auth (anon Supabase client
 * resolves the token → user) to match the codebase's existing auth pattern
 * in `lib/articles-api-auth.ts`.
 *
 * Anonymous readers receive a 200 + isSubscriber=false rather than 401, so
 * the client provider can update synchronously without error-handling noise.
 */
export async function GET(req: NextRequest) {
  const empty = NextResponse.json(
    { isSubscriber: false, status: null, plan: null, expires_at: null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );

  const auth = req.headers.get('authorization');
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) return empty;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return empty;

  const auther = createClient(url, anonKey);
  const { data: userData, error } = await auther.auth.getUser(token);
  if (error || !userData.user) return empty;

  const service = getServiceSupabase();
  if (!service) return empty;

  const row = await getReaderSubscriptionByUserId(service, userData.user.id);
  const subscriber = isActiveSubscriber(row);

  return NextResponse.json(
    {
      isSubscriber: subscriber,
      status: row?.subscription_status ?? null,
      plan: row?.subscription_plan ?? null,
      expires_at: row?.subscription_expires_at ?? null,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
