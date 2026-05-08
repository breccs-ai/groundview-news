import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const ADMIN_COOKIE = 'gvn_admin_session';
const ADMIN_COOKIE_VALUE = 'authenticated';

function isAdmin(): boolean {
  const cookie = cookies().get(ADMIN_COOKIE);
  return cookie?.value === ADMIN_COOKIE_VALUE;
}

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, pen_name, bio, expertise, created_at')
    .eq('role', 'journalist')
    .eq('subscription_status', 'pending_approval')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ rows: data ?? [] });
}

