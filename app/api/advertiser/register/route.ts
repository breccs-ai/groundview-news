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
    const { id, email, full_name } = body;

    if (!id || !email) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const emailNorm = String(email).trim().toLowerCase();
    const fullNameTrimmed = typeof full_name === 'string' ? full_name.trim() : '';

    const { data: existing } = await supabase
      .from('profiles')
      .select('id, roles, role')
      .eq('email', emailNorm)
      .maybeSingle();

    const existingRow = existing as {
      id: string;
      roles?: string[] | null;
      role?: string | null;
    } | null;

    if (existingRow) {
      if (existingRow.id !== id) {
        return NextResponse.json(
          { error: 'This email is linked to another sign-in identity. Try signing in with that account.' },
          { status: 403 }
        );
      }

      const { error: rpcErr } = await supabase.rpc('append_profile_advertiser_role', {
        p_id: id,
      });

      if (rpcErr) {
        const rolesArr = [...(existingRow.roles || []).map(String)];
        if (!rolesArr.includes('advertiser')) {
          rolesArr.push('advertiser');
        }
        const fb: Record<string, unknown> = { roles: rolesArr };
        if (fullNameTrimmed) fb.full_name = fullNameTrimmed;
        const { error: upErr } = await supabase.from('profiles').update(fb).eq('id', id);
        if (upErr) {
          return NextResponse.json({ error: upErr.message }, { status: 400 });
        }
      } else if (fullNameTrimmed) {
        const { error: nameErr } = await supabase
          .from('profiles')
          .update({ full_name: fullNameTrimmed })
          .eq('id', id);
        if (nameErr) {
          return NextResponse.json({ error: nameErr.message }, { status: 400 });
        }
      }

      return NextResponse.json({
        existing: true,
        message: 'Advertiser role added to your existing account',
      });
    }

    /** New profile tied to freshly created Auth user. */
    const { error } = await supabase.from('profiles').insert({
      id,
      email: emailNorm,
      full_name: fullNameTrimmed,
      role: 'advertiser',
      roles: ['advertiser'],
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, existing: false });
  } catch (err) {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
