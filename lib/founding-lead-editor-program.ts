import { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { WRITER_EMAIL_FROM } from '@/lib/writer-emails';
import { emailShell, escapeHtml, siteUrl } from '@/lib/email-branding';
import { JOURNALIST_APPROVAL_OWNER_EMAIL } from '@/lib/journalist-approval-workflow';

type Membership = {
  id: string;
  journalist_id: string;
  status: 'invited' | 'waitlisted' | 'accepted' | 'declined' | 'expired' | 'revoked';
  invitation_expires_at: string | null;
};

type Profile = { id: string; email: string; full_name: string; pen_name: string | null };

export async function evaluateFoundingLeadEditorEligibility(
  supabase: SupabaseClient,
  journalistId: string | null | undefined,
): Promise<void> {
  if (!journalistId) return;
  const { count, error: countError } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', journalistId)
    .eq('status', 'published')
    .eq('lead_editor_qualifying', true);
  if (countError || (count || 0) < 5) return;

  // Fill any newly available place from the existing waiting list before a
  // newly qualified writer can reserve it.
  const { data: promoted } = await supabase.rpc('maintain_founding_lead_editor_invitations', {
    p_max_places: 10,
    p_invitation_days: 14,
  });
  for (const row of promoted || []) await claimAndSendProgrammeNotification(supabase, row);

  const { data, error } = await supabase.rpc('reserve_founding_lead_editor_invitation', {
    p_journalist_id: journalistId,
    p_qualifying_article_count: count,
    p_max_places: 10,
    p_invitation_days: 14,
  });
  if (error || !data) {
    console.error('[lead-editor-program] eligibility reservation failed:', error?.message);
    return;
  }
  await claimAndSendProgrammeNotification(supabase, data as Membership);
}

export async function claimAndSendProgrammeNotification(
  supabase: SupabaseClient,
  membership: Membership,
): Promise<boolean> {
  if (membership.status !== 'invited' && membership.status !== 'waitlisted') return false;
  const { data: claimed } = await supabase
    .from('founding_lead_editor_memberships')
    .update({ notification_claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', membership.id)
    .eq('status', membership.status)
    .is('notification_claimed_at', null)
    .select('id')
    .maybeSingle();
  if (!claimed) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, pen_name')
    .eq('id', membership.journalist_id)
    .maybeSingle();
  if (!profile?.email) return false;

  const writer = profile as Profile;
  const dashboard = `${siteUrl()}/journalists/dashboard#founding-lead-editor`;
  if (membership.status === 'waitlisted') {
    await sendEmail(
      writer.email,
      'You have qualified for the Founding Lead Editor waiting list',
      emailShell(`<p>Congratulations ${escapeHtml(writer.pen_name || writer.full_name)},</p>
<p>You have published five articles and qualified for the Founding Lead Editor programme. The first ten places are currently reserved or accepted, so you have been added to the waiting list in qualification order.</p>
<p>If a place becomes available, we will contact you automatically. This is an optional opportunity and does not affect your existing writer access or earnings.</p>`),
      WRITER_EMAIL_FROM,
    );
    return true;
  }

  await sendEmail(
    writer.email,
    'An invitation to become a Founding Lead Editor',
    emailShell(`<p>Congratulations ${escapeHtml(writer.pen_name || writer.full_name)},</p>
<p>Publishing your fifth article has qualified you for an invitation to become one of Ground View News's first ten <strong>Founding Lead Editors</strong>.</p>
<p>The role is optional. It involves independently reviewing assigned writer applications, protecting applicant information and following Ground View News editorial standards. You will never review your own application or work.</p>
<p>If you accept, your own qualifying article earnings will later receive a 1.02 performance weighting inside the existing writer pool when that financial stage is activated. This is not guaranteed income, employment or an additional share of total revenue; Ground View News's 70% share remains unchanged.</p>
<p>Please respond within 14 days in your dashboard. We would also value your ideas about the subjects and editorial work you feel confident handling and the support that would help you thrive.</p>
<p><a href="${escapeHtml(dashboard)}">Review the invitation</a></p>`),
    WRITER_EMAIL_FROM,
  );
  await sendEmail(
    JOURNALIST_APPROVAL_OWNER_EMAIL,
    `Founding Lead Editor invitation sent: ${writer.pen_name || writer.full_name}`,
    emailShell(`<p>${escapeHtml(writer.full_name)} (${escapeHtml(writer.email)}) qualified after five published articles and received a 14-day Founding Lead Editor invitation.</p>`),
    WRITER_EMAIL_FROM,
  );
  return true;
}
