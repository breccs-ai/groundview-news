import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, email, full_name, pen_name, bio, expertise } = body as {
      id?: string;
      email?: string;
      full_name?: string;
      pen_name?: string;
      bio?: string;
      expertise?: string[];
    };

    if (!id || !email) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    if (!full_name || !pen_name || !bio) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    if (!Array.isArray(expertise) || expertise.length === 0) {
      return NextResponse.json({ error: 'Please select at least one area of expertise.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase.from('profiles').insert({
      id,
      email,
      full_name,
      pen_name,
      bio,
      role: 'journalist',
      subscription_status: 'pending_approval',
      subscription_tier: 'free',
      expertise,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await sendEmail(
      'editorial@groundviewnews.com',
      'New journalist application received',
      `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
          <h2 style="margin:0 0 12px;">New journalist application</h2>
          <p style="margin:0 0 6px;"><strong>Name:</strong> ${escapeHtml(full_name)}</p>
          <p style="margin:0 0 6px;"><strong>Pen name:</strong> ${escapeHtml(pen_name)}</p>
          <p style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p style="margin:0 0 6px;"><strong>Areas:</strong> ${escapeHtml(expertise.join(', '))}</p>
        </div>
      `.trim()
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
