import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import {
  WRITER_EMAIL_FROM,
  applicationApprovedEmail,
  applicationRejectedEmail,
} from '@/lib/writer-emails';

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

export async function POST(req: NextRequest) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { journalist_id, action, reason } = (await req.json().catch(() => ({}))) as {
    journalist_id?: string;
    action?: 'approve' | 'reject';
    reason?: string;
  };

  if (!journalist_id || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // We no longer require a reason on reject — the writer-facing rejection email is intentionally
  // generic. Reasons are still accepted for internal logging but not echoed in the email.
  void reason;

  const supabase = getServiceSupabase();

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, pen_name')
    .eq('id', journalist_id)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json({ error: profileErr?.message || 'Journalist not found.' }, { status: 404 });
  }

  const nextStatus = action === 'approve' ? 'active' : 'rejected';
  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ subscription_status: nextStatus })
    .eq('id', journalist_id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  await supabase
    .from('journalist_approval_assignments')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
      decision: action,
    })
    .eq('application_journalist_id', journalist_id)
    .eq('status', 'assigned');

  const profileRow = profile as {
    id: string;
    email: string;
    full_name: string;
    pen_name: string | null;
  };

  if (action === 'approve') {
    const tmpl = applicationApprovedEmail({
      fullName: profileRow.full_name || '',
      penName: profileRow.pen_name || profileRow.full_name || '',
    });
    await sendEmail(profileRow.email, tmpl.subject, tmpl.html, WRITER_EMAIL_FROM);
  } else {
    const tmpl = applicationRejectedEmail({ fullName: profileRow.full_name || '' });
    await sendEmail(profileRow.email, tmpl.subject, tmpl.html, WRITER_EMAIL_FROM);
  }

  return NextResponse.json({ ok: true, subscription_status: nextStatus });
}

