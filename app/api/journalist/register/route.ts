import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateWriterApplicationContent } from '@/lib/writer-application-validation';
import { enforceWriterApplicationRateLimit } from '@/lib/writer-application-rate-limit';
import { assignAndNotifyJournalistApplication, notifyOwnerOfApplication } from '@/lib/journalist-approval-workflow';

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, email, full_name, pen_name, bio, expertise, website } = body as {
      id?: string;
      email?: string;
      full_name?: string;
      pen_name?: string;
      bio?: string;
      expertise?: string[];
      website?: string;
    };

    // Honeypot: silently accept and discard bot submissions before any database work.
    if (String(website || '').trim()) {
      return NextResponse.json({ success: true, existing: false });
    }

    if (!id || !email) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    if (!full_name || !pen_name || !bio) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    if (!Array.isArray(expertise) || expertise.length === 0) {
      return NextResponse.json({ error: 'Please select at least one area of expertise.' }, { status: 400 });
    }

    const fullName = String(full_name).trim();
    const penName = String(pen_name).trim();
    const bioText = String(bio).trim();
    const contentValidation = validateWriterApplicationContent({
      fullName,
      penName,
      bio: bioText,
    });
    if (!contentValidation.valid) {
      return NextResponse.json({ error: contentValidation.error }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const rateLimitResponse = await enforceWriterApplicationRateLimit(req, supabase);
    if (rateLimitResponse) return rateLimitResponse;
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
        full_name: fullName,
        pen_name: penName,
        bio: bioText,
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

      if (sub !== 'active') {
        await notifyAndAssign(supabase, id, emailNorm, fullName, penName);
      }

      return NextResponse.json({
        existing: true,
        message: 'Journalist role added to your existing account — your updated application has been submitted for review.',
      });
    }

    const { error } = await supabase.from('profiles').insert({
      id,
      email: emailNorm,
      full_name: fullName,
      pen_name: penName,
      bio: bioText,
      role: 'journalist',
      roles: ['journalist'],
      subscription_status: 'pending_approval',
      subscription_tier: 'free',
      expertise,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await notifyAndAssign(supabase, id, emailNorm, fullName, penName);

    return NextResponse.json({ success: true, existing: false });
  } catch (err) {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}

async function notifyAndAssign(
  supabase: ReturnType<typeof getServiceSupabase>,
  id: string,
  emailNorm: string,
  full_name: string,
  pen_name: string,
) {
  const applicant = { id, email: emailNorm, full_name, pen_name };
  await notifyOwnerOfApplication(applicant, 'A new application was submitted and is awaiting approval.');
  await assignAndNotifyJournalistApplication(supabase, applicant);
}
