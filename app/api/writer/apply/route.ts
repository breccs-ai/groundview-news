import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import {
  WRITER_EMAIL_FROM,
  applicationReceivedEmail,
} from '@/lib/writer-emails';
import { validateWriterApplicationContent } from '@/lib/writer-application-validation';
import { enforceWriterApplicationRateLimit } from '@/lib/writer-application-rate-limit';
import { assignAndNotifyJournalistApplication, notifyOwnerOfApplication } from '@/lib/journalist-approval-workflow';
import { notifyOps } from '@/lib/ops-notifications';
import { escapeHtml } from '@/lib/email-branding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type ApplyBody = {
  full_name?: string;
  pen_name?: string;
  email?: string;
  password?: string;
  phone?: string;
  country?: string;
  bio?: string;
  categories?: string[];
  how_heard_about?: string | null;
  website?: string;
};

export async function POST(req: NextRequest) {
  let body: ApplyBody;
  try {
    body = (await req.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Honeypot: legitimate users never see or populate this field. Return the same
  // success shape as a real submission so automated clients are not alerted.
  if (String(body.website || '').trim()) {
    return NextResponse.json({ ok: true });
  }

  const full_name = String(body.full_name || '').trim();
  const pen_name = String(body.pen_name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const phone = String(body.phone || '').trim();
  const country = String(body.country || '').trim();
  const bio = String(body.bio || '').trim();
  const categories = Array.isArray(body.categories)
    ? body.categories.map((c) => String(c).trim()).filter(Boolean).slice(0, 16)
    : [];
  const how_heard_about =
    body.how_heard_about === null || body.how_heard_about === undefined
      ? null
      : String(body.how_heard_about).trim() || null;

  if (!full_name || !pen_name || !email || !phone || !country || !bio || categories.length === 0) {
    return NextResponse.json({ error: 'Please complete all required fields.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 }
    );
  }
  if (bio.length > 300) {
    return NextResponse.json({ error: 'Bio must be 300 characters or less.' }, { status: 400 });
  }

  const contentValidation = validateWriterApplicationContent({ fullName: full_name, penName: pen_name, bio });
  if (!contentValidation.valid) {
    return NextResponse.json({ error: contentValidation.error }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });
  }

  const rateLimitResponse = await enforceWriterApplicationRateLimit(req, supabase);
  if (rateLimitResponse) return rateLimitResponse;

  // Check whether this email already has an auth user.
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, roles, subscription_status')
    .eq('email', email)
    .maybeSingle();

  let userId: string | undefined = (existingProfile as { id?: string } | null)?.id;
  let awaitingApproval = true;

  if (!userId) {
    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, pen_name, source: 'writer_application' },
    });
    if (created.error || !created.data.user) {
      const msg = created.error?.message || '';
      if (msg.toLowerCase().includes('already')) {
        return NextResponse.json(
          {
            error:
              'An account with this email already exists. Please sign in and add writer access from your dashboard.',
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: msg || 'Could not create your account.' },
        { status: 400 }
      );
    }
    userId = created.data.user.id;
  }

  const existingRow = existingProfile as {
    id: string;
    roles?: string[] | null;
    subscription_status?: string | null;
  } | null;

  const baseProfile: Record<string, unknown> = {
    full_name,
    pen_name,
    bio,
    phone,
    country,
    how_heard_about,
    expertise: categories,
    role: 'journalist',
  };

  if (existingRow) {
    const currentRoles = [...(existingRow.roles || []).map(String)];
    if (!currentRoles.includes('journalist')) currentRoles.push('journalist');
    const sub = (existingRow.subscription_status || '').toLowerCase();
    awaitingApproval = sub !== 'active';

    const update: Record<string, unknown> = { ...baseProfile, roles: currentRoles };
    if (sub !== 'active') {
      update.subscription_status = 'pending_approval';
      update.subscription_tier = 'free';
    }

    const { error: upErr } = await supabase.from('profiles').update(update).eq('id', existingRow.id);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }
  } else {
    const { error: insertErr } = await supabase.from('profiles').insert({
      id: userId,
      email,
      ...baseProfile,
      roles: ['journalist'],
      subscription_status: 'pending_approval',
      subscription_tier: 'free',
    });
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 400 });
    }
  }

  const confirmation = applicationReceivedEmail({ fullName: full_name });
  await sendEmail(email, confirmation.subject, confirmation.html, WRITER_EMAIL_FROM);

  if (awaitingApproval) {
    const applicant = { id: userId, email, full_name, pen_name };
    await notifyOwnerOfApplication(applicant, 'A new application was submitted and is awaiting approval.');
    await notifyOps(
      `New writer application: ${full_name}`,
      `<p><strong>${escapeHtml(full_name)}</strong> (${escapeHtml(email)}) applied to write for Ground View News.</p>
<p><strong>Pen name:</strong> ${escapeHtml(pen_name)}<br/>
<strong>Country:</strong> ${escapeHtml(country)}<br/>
<strong>Categories:</strong> ${escapeHtml(categories.join(', '))}</p>`
    );
    await assignAndNotifyJournalistApplication(supabase, applicant);
  }

  return NextResponse.json({ ok: true });
}
