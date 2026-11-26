import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { isPlausibleName, isValidEmailFormat } from '@/lib/contact-spam-validation';
import { enforceNewsletterRateLimit } from '@/lib/newsletter-rate-limit';
import { NEWSLETTER_FROM, newsletterConfirmationEmail } from '@/lib/newsletter-emails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type NewsletterBody = {
  email?: string;
  first_name?: string;
  last_name?: string;
  website?: string;
};

export async function POST(req: NextRequest) {
  let body: NewsletterBody;
  try {
    body = (await req.json()) as NewsletterBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Honeypot: legitimate users never see or populate this field. Return the same
  // success shape as a real submission so automated clients are not alerted.
  if (String(body.website || '').trim()) {
    return NextResponse.json({ ok: true });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const first_name = String(body.first_name || '').trim();
  const last_name = String(body.last_name || '').trim();

  if (!email || !first_name || !last_name) {
    return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
  }
  if (!isValidEmailFormat(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  if (!isPlausibleName(first_name)) {
    return NextResponse.json({ error: 'Please enter a valid first name.' }, { status: 400 });
  }
  if (!isPlausibleName(last_name)) {
    return NextResponse.json({ error: 'Please enter a valid last name.' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });
  }

  const rateLimitResponse = await enforceNewsletterRateLimit(req, supabase);
  if (rateLimitResponse) return rateLimitResponse;

  // Double opt-in: the address is stored unconfirmed and nothing is sent to it until
  // its owner clicks the link in the confirmation email.
  const { error } = await supabase
    .from('subscribers')
    .insert({ email, first_name, last_name, confirmed: false });

  if (error) {
    if (error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // Already on the list. If they never confirmed, send the confirmation again so a
    // lost or expired email is not a dead end; if they did, say so.
    const { data: existing } = await supabase
      .from('subscribers')
      .select('confirmed')
      .eq('email', email)
      .maybeSingle();
    if (existing?.confirmed) {
      return NextResponse.json({ error: 'already_subscribed' }, { status: 409 });
    }
  }

  const confirmation = newsletterConfirmationEmail(email, first_name);
  const emailSent = await sendEmail(email, confirmation.subject, confirmation.html, NEWSLETTER_FROM);

  return NextResponse.json({ ok: true, confirmation_sent: emailSent });
}
