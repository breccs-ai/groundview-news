import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { isPlausibleName, isPlausibleFreeText, isValidEmailFormat } from '@/lib/contact-spam-validation';
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

type EnquiryBody = {
  name?: string;
  contact_name?: string;
  email?: string;
  package_interest?: string;
  message?: string;
  website?: string;
};

export async function POST(req: NextRequest) {
  let body: EnquiryBody;
  try {
    body = (await req.json()) as EnquiryBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Honeypot: legitimate users never see or populate this field. Return the same
  // success shape as a real submission so automated clients are not alerted.
  if (String(body.website || '').trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = String(body.name || '').trim();
  const contact_name = String(body.contact_name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const package_interest = String(body.package_interest || '').trim();
  const message = String(body.message || '').trim();

  if (!name || !contact_name || !email) {
    return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
  }

  if (!isValidEmailFormat(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  if (!isPlausibleName(name)) {
    return NextResponse.json({ error: 'Please enter a valid company name.' }, { status: 400 });
  }
  if (!isPlausibleName(contact_name)) {
    return NextResponse.json({ error: 'Please enter a valid contact name.' }, { status: 400 });
  }
  if (message && !isPlausibleFreeText(message)) {
    return NextResponse.json({ error: 'Please enter a valid message.' }, { status: 400 });
  }
  if (package_interest && !isPlausibleFreeText(package_interest)) {
    return NextResponse.json({ error: 'Please select a valid package.' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });
  }

  const rateLimitResponse = await enforceContactRateLimit(req, supabase);
  if (rateLimitResponse) return rateLimitResponse;

  const { error } = await supabase.from('contact_messages').insert({
    name: `${contact_name} (${name})`,
    email,
    subject: `Advertising enquiry: ${package_interest || 'unspecified package'}`,
    message: message || '',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await sendEmail(
    'advertising@groundviewnews.com',
    `New Advertising Enquiry: ${name}`,
    `<p><strong>Company:</strong> ${escapeHtml(name)}</p>
<p><strong>Contact:</strong> ${escapeHtml(contact_name)}</p>
<p><strong>Email:</strong> ${escapeHtml(email)}</p>
<p><strong>Package interest:</strong> ${escapeHtml(package_interest || 'Not specified')}</p>
<p><strong>Message:</strong></p>
<p>${escapeHtml(message || '').replace(/\n/g, '<br />')}</p>`
  );

  return NextResponse.json({ ok: true });
}
