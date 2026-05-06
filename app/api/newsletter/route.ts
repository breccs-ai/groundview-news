import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from('subscribers')
    .insert({ email: email.trim().toLowerCase(), confirmed: false });

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'already_subscribed' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await sendEmail(
    email,
    'Welcome to Ground View News',
    `<p>Thank you for subscribing to Ground View News.</p>
<p>You will receive our latest commentary and analysis directly to your inbox.</p>
<p>Ground View News — Independent global commentary.</p>
<p style="font-size:12px;color:#888;">You subscribed at groundviewnews.com. To unsubscribe, reply to this email with "unsubscribe" in the subject line.</p>`
  );

  return NextResponse.json({ ok: true });
}
