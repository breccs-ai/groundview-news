import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { adminFeedbackEmail } from '@/lib/writer-emails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function getAnonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

async function authedUser(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) return null;
  const supabase = getAnonSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function POST(req: NextRequest) {
  const user = await authedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    subject?: string;
    message?: string;
    rating?: number;
  };
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();
  const rating = Number(body.rating);

  if (!subject) {
    return NextResponse.json({ error: 'Subject is required.' }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be an integer 1–5.' }, { status: 400 });
  }
  if (subject.length > 200 || message.length > 4000) {
    return NextResponse.json({ error: 'Subject or message is too long.' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });
  }

  const { error: insertErr } = await supabase.from('writer_feedback').insert({
    writer_id: user.id,
    subject,
    message,
    rating,
  });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, pen_name, email')
    .eq('id', user.id)
    .maybeSingle();

  const profileRow = profile as
    | { full_name?: string | null; pen_name?: string | null; email?: string | null }
    | null;

  const fallbackFrom = process.env.RESEND_FROM_EMAIL || 'noreply@groundviewnews.com';
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim() || fallbackFrom;

  const template = adminFeedbackEmail({
    fullName: profileRow?.full_name || '(unknown)',
    penName: profileRow?.pen_name || '',
    email: profileRow?.email || user.email || '',
    subject,
    message,
    rating,
  });
  await sendEmail(adminEmail, template.subject, template.html);

  return NextResponse.json({ ok: true });
}
