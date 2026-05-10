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
    const emailNorm = String(email).trim().toLowerCase();

    const { data: existing } = await supabase
      .from('profiles')
      .select('id, roles, subscription_status')
      .eq('email', emailNorm)
      .maybeSingle();

    const existingRow = existing as {
      id: string;
      roles?: string[] | null;
      subscription_status?: string | null;
    } | null;

    if (existingRow) {
      if (existingRow.id !== id) {
        return NextResponse.json(
          { error: 'This email is linked to another sign-in identity. Try signing in with that account.' },
          { status: 403 }
        );
      }

      const currentRoles = [...(existingRow.roles || []).map(String)];
      if (!currentRoles.includes('journalist')) {
        currentRoles.push('journalist');
      }

      const sub = (existingRow.subscription_status || '').toLowerCase();
      const update: Record<string, unknown> = {
        roles: currentRoles,
        full_name,
        pen_name,
        bio,
        expertise,
      };
      if (sub !== 'active') {
        update.subscription_status = 'pending_approval';
        update.subscription_tier = 'free';
      }

      const { error: upErr } = await supabase.from('profiles').update(update).eq('id', id);
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 400 });
      }

      await sendJournalistDigestEmail(emailNorm, full_name, pen_name, expertise);

      return NextResponse.json({
        existing: true,
        message: 'Journalist role added to your existing account — your updated application has been submitted for review.',
      });
    }

    const { error } = await supabase.from('profiles').insert({
      id,
      email: emailNorm,
      full_name,
      pen_name,
      bio,
      role: 'journalist',
      roles: ['journalist'],
      subscription_status: 'pending_approval',
      subscription_tier: 'free',
      expertise,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await sendJournalistDigestEmail(emailNorm, full_name, pen_name, expertise);

    return NextResponse.json({ success: true, existing: false });
  } catch (err) {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}

async function sendJournalistDigestEmail(
  emailNorm: string,
  full_name: string,
  pen_name: string,
  expertise: string[],
) {
  await sendEmail(
    'editorial@groundviewnews.com',
    'New journalist application received',
    `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
          <h2 style="margin:0 0 12px;">New journalist application</h2>
          <p style="margin:0 0 6px;"><strong>Name:</strong> ${escapeHtml(full_name)}</p>
          <p style="margin:0 0 6px;"><strong>Pen name:</strong> ${escapeHtml(pen_name)}</p>
          <p style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(emailNorm)}</p>
          <p style="margin:0 0 6px;"><strong>Areas:</strong> ${escapeHtml(expertise.join(', '))}</p>
        </div>
      `.trim(),
  );
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
