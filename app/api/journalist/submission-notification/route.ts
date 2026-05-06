import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const { title, pen_name, author_email } = await req.json();

  await Promise.all([
    sendEmail(
      'editorial@groundviewnews.com',
      `New article submitted for review: ${title}`,
      `<p>A new article has been submitted for editorial review.</p>
<p><strong>Title:</strong> ${title}</p>
<p><strong>Pen name:</strong> ${pen_name}</p>
<p><strong>Author email:</strong> ${author_email}</p>
<p>Review it in the <a href="https://groundviewnews.com/admin/dashboard">admin dashboard</a>.</p>`
    ),
    sendEmail(
      author_email,
      `Your article has been submitted: ${title}`,
      `<p>Thank you for submitting your article to Ground View News.</p>
<p><strong>Title:</strong> ${title}</p>
<p>Our editorial team will review your submission and respond within five working days.</p>
<p>Ground View News — Independent global commentary.</p>`
    ),
  ]);

  return NextResponse.json({ ok: true });
}
