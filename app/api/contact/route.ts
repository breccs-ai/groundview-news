import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { validateContactSubmission } from '@/lib/contact-spam-validation';
import { enforceContactRateLimit } from '@/lib/contact-rate-limit';
import { escapeHtml } from '@/lib/html-escape';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type ContactBody = {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  website?: string;
};

export async function POST(req: NextRequest) {
  let body: ContactBody;
  try {
    body = (await req.json()) as ContactBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Honeypot: legitimate users never see or populate this field. Return the same
  // success shape as a real submission so automated clients are not alerted.
  if (String(body.website || '').trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }

  const validation = validateContactSubmission({ name, email, subject, message });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });
  }

  const rateLimitResponse = await enforceContactRateLimit(req, supabase);
  if (rateLimitResponse) return rateLimitResponse;

  const { error } = await supabase.from('contact_messages').insert({ name, email, subject, message });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await sendEmail(
    'info@groundviewnews.com',
    `New Contact Message: ${subject}`,
    `<p><strong>Name:</strong> ${escapeHtml(name)}</p>
<p><strong>Email:</strong> ${escapeHtml(email)}</p>
<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
<p><strong>Message:</strong></p>
<p>${escapeHtml(message).replace(/\n/g, '<br />')}</p>`
  );

  const confirmationHtml = `<p>Thank you for reaching out to Ground View News. We have received your message and will be in touch as soon as possible.</p>
<p>This is an automated confirmation. Please do not reply to this email.</p>
<p>Ground View News<br />groundviewnews.com</p>`;

  await sendEmail(
    email,
    'We have received your message — Ground View News',
    confirmationHtml,
    'Ground View News <info@groundviewnews.com>'
  );

  return NextResponse.json({ ok: true });
}
