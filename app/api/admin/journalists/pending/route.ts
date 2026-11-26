import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminServerSession } from '@/lib/admin-server';

async function isAdmin(): Promise<boolean> {
  return isAdminServerSession();
}

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, pen_name, bio, expertise, phone, country, how_heard_about, created_at'
    )
    .eq('role', 'journalist')
    .eq('subscription_status', 'pending_approval')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ rows: data ?? [] });
}

