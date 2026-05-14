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
  const { name, email, subject, message } = await req.json();

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase.from('contact_messages').insert({ name, email, subject, message });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await sendEmail(
    'info@groundviewnews.com',
    `New Contact Message: ${subject}`,
    `<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Subject:</strong> ${subject}</p>
<p><strong>Message:</strong></p>
<p>${message.replace(/\n/g, '<br />')}</p>`
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
