import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

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

  if (action === 'reject' && (!reason || reason.trim().length < 3)) {
    return NextResponse.json({ error: 'Rejection reason is required.' }, { status: 400 });
  }

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

  if (action === 'approve') {
    await sendEmail(
      profile.email,
      'Welcome to Ground View News — Your Account is Approved',
      `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
          <p>Congratulations. Your journalist account has been approved.</p>
          <p>You can now log in and submit articles at <a href="https://groundviewnews.com/journalists/login">groundviewnews.com/journalists/login</a>.</p>
          <p>Please read our editorial guidelines before submitting your first article.</p>
        </div>
      `.trim()
    );
  } else {
    await sendEmail(
      profile.email,
      'Ground View News — Journalist Application Update',
      `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
          <p>Thank you for applying to Ground View News. After review, we’re not able to approve your journalist account at this time.</p>
          <p><strong>Reason:</strong> ${escapeHtml(reason!.trim())}</p>
          <p>You’re welcome to reapply in the future with updated details.</p>
        </div>
      `.trim()
    );
  }

  return NextResponse.json({ ok: true, subscription_status: nextStatus });
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

