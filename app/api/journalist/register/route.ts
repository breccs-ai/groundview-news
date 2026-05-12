import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, email, full_name, pen_name, bio, subscription_tier } = body;

    if (!id || !email) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase.from('profiles').insert({
      id,
      email,
      full_name,
      pen_name,
      bio,
      role: 'journalist',
      subscription_tier,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
