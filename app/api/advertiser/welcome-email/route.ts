import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const { email, full_name } = await req.json();

  await sendEmail(
    email,
    'Welcome to Ground View News — Advertiser Portal',
    `<p>Hi ${full_name},</p>
<p>Welcome to the Ground View News Advertiser Portal. Your account is now active.</p>
<p>You can create and manage your ads at any time by visiting <a href="https://groundviewnews.com/advertiser/dashboard">your dashboard</a>.</p>
<p>If you have any questions, please contact our advertising team at <a href="mailto:advertising@groundviewnews.com">advertising@groundviewnews.com</a>.</p>
<p>Ground View News — Independent global commentary.</p>`
  );

  return NextResponse.json({ ok: true });
}
