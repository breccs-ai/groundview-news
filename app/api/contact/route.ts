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
    'editorial@groundviewnews.com',
    `New Contact Message: ${subject}`,
    `<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Subject:</strong> ${subject}</p>
<p><strong>Message:</strong></p>
<p>${message.replace(/\n/g, '<br />')}</p>`
  );

  return NextResponse.json({ ok: true });
}
