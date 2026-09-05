import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { isPlausibleName, isValidEmailFormat } from '@/lib/contact-spam-validation';
import { enforceNewsletterRateLimit } from '@/lib/newsletter-rate-limit';
import { emailShell, escapeHtml } from '@/lib/email-branding';

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

  const { error } = await supabase
    .from('subscribers')
    .insert({ email, first_name, last_name, confirmed: false });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'already_subscribed' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await sendEmail(
    email,
    'Welcome to Ground View News',
    emailShell(
      `<p>Thank you for subscribing to Ground View News, ${escapeHtml(first_name)}.</p>
<p>You will receive our latest commentary and analysis directly to your inbox.</p>`,
      {
        footerExtra:
          'You\'re receiving this because you subscribed to the Ground View News newsletter at groundviewnews.com. To unsubscribe, reply to this email with "unsubscribe" in the subject line.',
      }
    )
  );

  return NextResponse.json({ ok: true });
}
