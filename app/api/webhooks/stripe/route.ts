import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const PACKAGE_DAYS: Record<number, number> = { 7: 7, 14: 14, 30: 30, 60: 60, 90: 90 };

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !sig) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };

  try {
    const crypto = await import('crypto');
    const [timestampPart, ...v1Parts] = sig.split(',').map((p) => p.split('='));
    const timestamp = timestampPart[1];
    const v1 = v1Parts.find((p) => p[0] === 'v1')?.[1];
    const payload = `${timestamp}.${body}`;
    const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
    if (expected !== v1) throw new Error('Invalid signature');
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Record<string, unknown>;
    const metadata = session.metadata as Record<string, string> | undefined;
    const adId = metadata?.adId;
    const packageDays = Number(metadata?.packageDays);

    if (!adId || !PACKAGE_DAYS[packageDays]) {
      return NextResponse.json({ received: true });
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + packageDays * 24 * 60 * 60 * 1000);

    const supabase = getSupabase();
    const { data: ad } = await supabase
      .from('advertisements')
      .update({
        status: 'active',
        stripe_payment_intent_id: session.payment_intent as string || null,
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', adId)
      .select('*, profiles(email, full_name)')
      .maybeSingle();

    if (ad) {
      const profile = (ad as unknown as { profiles: { email: string; full_name: string } }).profiles;
      if (profile?.email) {
        await sendEmail(
          profile.email,
          'Your Ground View News ad is now live',
          `<p>Hi ${profile.full_name || 'there'},</p>
<p>Your ad <strong>${(ad as Record<string, unknown>).title}</strong> is now live on Ground View News.</p>
<p><strong>Live from:</strong> ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
<p><strong>Live until:</strong> ${endsAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
<p>Manage your ads at <a href="https://groundviewnews.com/advertise/dashboard">your dashboard</a>.</p>`
        );
      }

      await sendEmail(
        'advertising@groundviewnews.com',
        `Ad activated: ${(ad as Record<string, unknown>).title}`,
        `<p><strong>Ad ID:</strong> ${adId}</p>
<p><strong>Company:</strong> ${(ad as Record<string, unknown>).company_name}</p>
<p><strong>Title:</strong> ${(ad as Record<string, unknown>).title}</p>
<p><strong>Package:</strong> ${packageDays} days</p>
<p><strong>Advertiser:</strong> ${profile?.email || 'unknown'}</p>`
      );
    }
  }

  return NextResponse.json({ received: true });
}
