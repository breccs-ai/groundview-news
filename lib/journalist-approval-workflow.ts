import { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { WRITER_EMAIL_FROM } from '@/lib/writer-emails';
import { emailShell, escapeHtml, siteUrl } from '@/lib/email-branding';
import { notifyOps } from '@/lib/ops-notifications';

export const JOURNALIST_APPROVAL_OWNER_EMAIL = 'info@breccs.com';

type Applicant = { id: string; email: string; full_name: string; pen_name?: string | null };
type Assignment = {
  id: string;
  approver_journalist_id: string | null;
  attempt_number: number;
  status: 'assigned' | 'escalated';
  due_at: string;
};

export async function assignAndNotifyJournalistApplication(
  supabase: SupabaseClient,
  applicant: Applicant,
): Promise<Assignment | null> {
  const { data, error } = await supabase.rpc('assign_journalist_application', {
    p_application_journalist_id: applicant.id,
  });
  if (error) {
    console.error('[journalist-approval] assignment failed:', error.message);
    await notifyOwnerOfApplication(applicant, `Automatic assignment failed: ${error.message}`);
    return null;
  }

  const assignment = data as Assignment;
  if (assignment.status === 'escalated' || !assignment.approver_journalist_id) {
    await notifyOwnerOfApplication(applicant, 'No eligible lead approver is currently available.');
    return assignment;
  }

  const { data: lead } = await supabase
    .from('profiles')
    .select('email, full_name, pen_name')
    .eq('id', assignment.approver_journalist_id)
    .maybeSingle();

  if (!lead?.email) {
    await notifyOwnerOfApplication(applicant, 'The assigned lead approver has no deliverable email address.');
    return assignment;
  }

  await sendEmail(
    lead.email,
    `Writer application awaiting your review: ${applicant.pen_name || applicant.full_name}`,
    emailShell(`<p>Hi ${escapeHtml(lead.pen_name || lead.full_name || 'Lead Editor')},</p>
<p>A writer application has been assigned only to you for review.</p>
<p><strong>Applicant:</strong> ${escapeHtml(applicant.full_name)}<br/>
<strong>Pen name:</strong> ${escapeHtml(applicant.pen_name || 'Not provided')}</p>
<p>Please review it within <strong>24 hours</strong>. If you cannot respond, it will automatically move to another lead editor.</p>
<p><a href="${escapeHtml(`${siteUrl()}/journalists/dashboard#application-reviews`)}">Open your Lead Editor queue</a></p>
<p>Make the decision independently using Ground View News editorial standards. Do not contact the applicant privately or share their application details.</p>`),
    WRITER_EMAIL_FROM,
  );

  await notifyOps(
    `Writer application assigned for review: ${applicant.pen_name || applicant.full_name}`,
    `<p><strong>Applicant:</strong> ${escapeHtml(applicant.full_name)} (${escapeHtml(applicant.email)})</p>
<p><strong>Assigned to:</strong> ${escapeHtml(lead.pen_name || lead.full_name || lead.email)}</p>
<p><strong>Due:</strong> ${escapeHtml(assignment.due_at)} (auto-reassigns to another lead editor if not decided by then)</p>`
  );

  return assignment;
}
export async function notifyOwnerOfApplication(applicant: Applicant, note: string): Promise<void> {
  await sendEmail(
    JOURNALIST_APPROVAL_OWNER_EMAIL,
    `Writer application requires attention: ${applicant.pen_name || applicant.full_name}`,
    `<h2>Writer application awaiting approval</h2>
<p><strong>Name:</strong> ${escapeHtml(applicant.full_name)}<br/>
<strong>Pen name:</strong> ${escapeHtml(applicant.pen_name || 'Not provided')}<br/>
<strong>Email:</strong> ${escapeHtml(applicant.email)}</p>
<p><strong>Workflow note:</strong> ${escapeHtml(note)}</p>
<p><a href="${escapeHtml(`${siteUrl()}/admin`)}">Open the admin review queue</a></p>`,
    WRITER_EMAIL_FROM,
  );
}
