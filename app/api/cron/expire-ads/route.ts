import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data: expiredAds } = await supabase
    .from('advertisements')
    .select('id, title, company_name, user_id, profiles(email, full_name)')
    .eq('status', 'active')
    .lt('ends_at', now);

  let count = 0;

  for (const ad of expiredAds || []) {
    const adRecord = ad as Record<string, unknown>;
    const profile = adRecord.profiles as { email: string; full_name: string } | null;

    await supabase.from('advertisements')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', adRecord.id);

    if (profile?.email) {
      await sendEmail(
        profile.email,
        'Your Ground View News ad has expired',
        `<p>Hi ${profile.full_name || 'there'},</p>
<p>Your ad <strong>${adRecord.title || adRecord.company_name}</strong> has expired.</p>
<p>Renew your ad or create a new one at any time: <a href="https://groundviewnews.com/advertise/dashboard">Advertiser Dashboard</a></p>`
      );
    }

    count++;
  }

  return NextResponse.json({ ok: true, expired: count });
}
