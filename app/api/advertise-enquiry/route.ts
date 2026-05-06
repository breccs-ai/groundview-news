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
  const { name, contact_name, email, package_interest, message } = await req.json();

  if (!name || !contact_name || !email) {
    return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
  }

  const supabase = getSupabase();
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
    `<p><strong>Company:</strong> ${name}</p>
<p><strong>Contact:</strong> ${contact_name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Package interest:</strong> ${package_interest || 'Not specified'}</p>
<p><strong>Message:</strong></p>
<p>${(message || '').replace(/\n/g, '<br />')}</p>`
  );

  return NextResponse.json({ ok: true });
}
