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
  const now = new Date();
  const h72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const h120 = new Date(now.getTime() - 120 * 60 * 60 * 1000);

  const { data: drafts } = await supabase
    .from('advertisements')
    .select('id, title, company_name, user_id, updated_at, reminder_sent_at, final_reminder_sent_at, profiles(email, full_name)')
    .eq('status', 'draft')
    .lt('updated_at', h72.toISOString());

  let reminded = 0;
  let discarded = 0;

  for (const ad of drafts || []) {
    const adRecord = ad as Record<string, unknown>;
    const profile = adRecord.profiles as { email: string; full_name: string } | null;
    if (!profile?.email) continue;

    const updatedAt = new Date(adRecord.updated_at as string);
    const needsFinalReminder = updatedAt < h120 && !adRecord.final_reminder_sent_at;
    const needsFirstReminder = updatedAt < h72 && !adRecord.reminder_sent_at && !adRecord.final_reminder_sent_at;

    if (needsFinalReminder) {
      await supabase.from('advertisements')
        .update({ status: 'discarded', final_reminder_sent_at: now.toISOString(), updated_at: now.toISOString() })
        .eq('id', adRecord.id);

      await sendEmail(
        profile.email,
        'Your Ground View News ad draft has been discarded',
        `<p>Hi ${profile.full_name || 'there'},</p>
<p>Your saved ad draft has been discarded after 7 days of inactivity. You can create a new ad at any time.</p>
<p><a href="https://groundviewnews.com/advertise/new">Create a new ad</a></p>`
      );
      discarded++;
    } else if (needsFirstReminder) {
      await supabase.from('advertisements')
        .update({ reminder_sent_at: now.toISOString() })
        .eq('id', adRecord.id);

      await sendEmail(
        profile.email,
        'You have an unfinished ad on Ground View News',
        `<p>Hi ${profile.full_name || 'there'},</p>
<p>You started creating an ad on Ground View News but haven't completed it yet.</p>
<p><a href="https://groundviewnews.com/advertise/new?draft=${adRecord.id}">Complete your ad here</a></p>
<p>If you no longer wish to continue, you can ignore this email.</p>`
      );
      reminded++;
    }
  }

  return NextResponse.json({ ok: true, reminded, discarded });
}
