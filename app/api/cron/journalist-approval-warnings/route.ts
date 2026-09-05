import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyOps } from '@/lib/ops-notifications';
import { escapeHtml } from '@/lib/email-branding';

export const dynamic = 'force-dynamic';

/**
 * Hourly watchdog: warns info@groundviewnews.com when an assigned journalist
 * application review is within 12 hours of its 24h due_at, i.e. halfway to
 * automatic reassignment (see journalist-approval-escalations, which fires
 * after due_at passes). warning_sent_at makes this idempotent across runs.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const now = new Date();
  const warningHorizon = new Date(now.getTime() + 12 * 60 * 60 * 1000);

  const { data: dueSoon, error } = await service
    .from('journalist_approval_assignments')
    .select('id, application_journalist_id, approver_journalist_id, due_at')
    .eq('status', 'assigned')
    .is('warning_sent_at', null)
    .gt('due_at', now.toISOString())
    .lte('due_at', warningHorizon.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let notified = 0;
  for (const row of dueSoon || []) {
    const [{ data: applicant }, { data: approver }] = await Promise.all([
      service.from('profiles').select('full_name, pen_name, email').eq('id', row.application_journalist_id).maybeSingle(),
      service.from('profiles').select('full_name, pen_name, email').eq('id', row.approver_journalist_id).maybeSingle(),
    ]);

    await notifyOps(
      `Review due soon: ${applicant?.pen_name || applicant?.full_name || 'writer application'}`,
      `<p>A writer application review is within 12 hours of automatically reassigning to another lead editor.</p>
<p><strong>Applicant:</strong> ${escapeHtml(applicant?.full_name || 'Unknown')} (${escapeHtml(applicant?.email || 'no email')})</p>
<p><strong>Assigned to:</strong> ${escapeHtml(approver?.pen_name || approver?.full_name || 'Unknown')} (${escapeHtml(approver?.email || 'no email')})</p>
<p><strong>Due:</strong> ${escapeHtml(row.due_at)}</p>`
    );

    await service
      .from('journalist_approval_assignments')
      .update({ warning_sent_at: now.toISOString() })
      .eq('id', row.id);

    notified += 1;
  }

  return NextResponse.json({ ok: true, notified });
}
