import { NextRequest, NextResponse } from 'next/server';
import { resolveLeadEditor } from '@/lib/lead-editor-auth';
import { sendEmail } from '@/lib/email';
import { applicationApprovedEmail, applicationRejectedEmail, WRITER_EMAIL_FROM } from '@/lib/writer-emails';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await resolveLeadEditor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: assignments, error } = await actor.service
    .from('journalist_approval_assignments')
    .select('id, application_journalist_id, attempt_number, assigned_at, due_at')
    .eq('approver_journalist_id', actor.user.id)
    .eq('status', 'assigned')
    .gt('due_at', new Date().toISOString())
    .order('due_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ids = (assignments || []).map((row) => row.application_journalist_id);
  if (ids.length === 0) return NextResponse.json({ rows: [] });
  const { data: profiles, error: profileError } = await actor.service
    .from('profiles')
    .select('id, full_name, pen_name, bio, expertise, country, how_heard_about, created_at')
    .in('id', ids)
    .eq('subscription_status', 'pending_approval');
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return NextResponse.json({
    rows: (assignments || []).flatMap((assignment) => {
      const applicant = profileMap.get(assignment.application_journalist_id);
      return applicant ? [{ ...assignment, applicant }] : [];
    }),
  });
}

export async function POST(req: NextRequest) {
  const actor = await resolveLeadEditor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    assignment_id?: string;
    decision?: 'approve' | 'reject';
  };
  if (!body.assignment_id || !['approve', 'reject'].includes(body.decision || '')) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { data: assignment } = await actor.service
    .from('journalist_approval_assignments')
    .select('id, application_journalist_id, status, due_at')
    .eq('id', body.assignment_id)
    .eq('approver_journalist_id', actor.user.id)
    .eq('status', 'assigned')
    .maybeSingle();
  if (!assignment || new Date(assignment.due_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'This assignment is no longer available.' }, { status: 409 });
  }

  const { data: applicant } = await actor.service
    .from('profiles')
    .select('id, email, full_name, pen_name, subscription_status')
    .eq('id', assignment.application_journalist_id)
    .eq('subscription_status', 'pending_approval')
    .maybeSingle();
  if (!applicant) return NextResponse.json({ error: 'Application is no longer pending.' }, { status: 409 });

  const nextStatus = body.decision === 'approve' ? 'active' : 'rejected';
  const { data: updatedProfile, error: profileError } = await actor.service
    .from('profiles')
    .update({ subscription_status: nextStatus })
    .eq('id', applicant.id)
    .eq('subscription_status', 'pending_approval')
    .select('id')
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  if (!updatedProfile) return NextResponse.json({ error: 'Application was already decided.' }, { status: 409 });

  await actor.service
    .from('journalist_approval_assignments')
    .update({ status: 'completed', completed_at: new Date().toISOString(), decision: body.decision })
    .eq('id', assignment.id)
    .eq('status', 'assigned');

  const template = body.decision === 'approve'
    ? applicationApprovedEmail({ fullName: applicant.full_name || '', penName: applicant.pen_name || applicant.full_name || '' })
    : applicationRejectedEmail({ fullName: applicant.full_name || '' });
  await sendEmail(applicant.email, template.subject, template.html, WRITER_EMAIL_FROM);

  return NextResponse.json({ ok: true, subscription_status: nextStatus });
}
