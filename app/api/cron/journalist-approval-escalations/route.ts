import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assignAndNotifyJournalistApplication } from '@/lib/journalist-approval-workflow';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const now = new Date().toISOString();
  const { data: overdue, error } = await service
    .from('journalist_approval_assignments')
    .select('application_journalist_id')
    .eq('status', 'assigned')
    .lte('due_at', now);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const applicationIds = Array.from(new Set((overdue || []).map((row) => row.application_journalist_id)));
  let processed = 0;
  for (const id of applicationIds) {
    const { data: applicant } = await service
      .from('profiles')
      .select('id, email, full_name, pen_name')
      .eq('id', id)
      .eq('subscription_status', 'pending_approval')
      .maybeSingle();
    if (!applicant) continue;
    await assignAndNotifyJournalistApplication(service, applicant);
    processed += 1;
  }
  return NextResponse.json({ ok: true, processed });
}
