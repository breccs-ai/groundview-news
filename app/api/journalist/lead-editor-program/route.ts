import { NextRequest, NextResponse } from 'next/server';
import { getApprovedWriter } from '@/lib/writer-server-auth';
import { getServiceSupabase } from '@/lib/supabase-service';
import { sendEmail } from '@/lib/email';
import { JOURNALIST_APPROVAL_OWNER_EMAIL } from '@/lib/journalist-approval-workflow';
import { claimAndSendProgrammeNotification } from '@/lib/founding-lead-editor-program';
import { WRITER_EMAIL_FROM, escapeHtml } from '@/lib/writer-emails';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const writer = await getApprovedWriter(req);
  const service = getServiceSupabase();
  if (!writer || !service) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: membership } = await service
    .from('founding_lead_editor_memberships')
    .select('id, status, qualifying_article_count, qualified_at, invitation_expires_at, accepted_at')
    .eq('journalist_id', writer.id)
    .maybeSingle();
  return NextResponse.json({ membership: membership || null });
}

export async function POST(req: NextRequest) {
  const writer = await getApprovedWriter(req);
  const service = getServiceSupabase();
  if (!writer || !service) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    response?: 'accept' | 'decline';
    confidence_areas?: string[];
    support_requested?: string;
    ideas?: string;
    permission_to_follow_up?: boolean;
  };
  if (body.response !== 'accept' && body.response !== 'decline') {
    return NextResponse.json({ error: 'Choose accept or decline.' }, { status: 400 });
  }

  const confidenceAreas = Array.isArray(body.confidence_areas)
    ? body.confidence_areas.map(String).map((value) => value.trim()).filter(Boolean).slice(0, 12)
    : [];
  const supportRequested = String(body.support_requested || '').trim().slice(0, 2000);
  const ideas = String(body.ideas || '').trim().slice(0, 3000);

  const { data: membership, error } = await service.rpc('respond_to_founding_lead_editor_invitation', {
    p_journalist_id: writer.id,
    p_response: body.response,
  });
  if (error || !membership) {
    return NextResponse.json({ error: error?.message || 'The invitation could not be updated.' }, { status: 409 });
  }

  if (confidenceAreas.length || supportRequested || ideas) {
    await service.from('journalist_platform_feedback').insert({
      journalist_id: writer.id,
      context: 'founding_lead_editor_invitation',
      confidence_areas: confidenceAreas,
      support_requested: supportRequested || null,
      ideas: ideas || null,
      permission_to_follow_up: body.permission_to_follow_up !== false,
    });
  }

  const outcome = body.response === 'accept' ? 'accepted' : 'declined';
  await sendEmail(
    writer.email,
    body.response === 'accept' ? 'Your Founding Lead Editor access is active' : 'Your Founding Lead Editor response',
    body.response === 'accept'
      ? `<p>Congratulations ${escapeHtml(writer.penName)},</p>
<p>You have completed the Founding Lead Editor acceptance process. Your restricted Lead Editor access is now active.</p>
<p><a href="${escapeHtml(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://groundviewnews.com'}/journalists/dashboard#application-reviews`)}">Open your Lead Editor review queue</a></p>
<h3>Your responsibilities</h3>
<ul>
  <li>Review only the writer applications assigned to your private queue.</li>
  <li>Aim to decide each assignment within <strong>24 hours</strong>. If you cannot respond, it will move automatically to another Lead Editor.</li>
  <li>Keep applicant names, contact details, biographies and other application information confidential.</li>
  <li>Apply Ground View News editorial standards independently and consistently.</li>
  <li>Do not approve yourself, someone with whom you have a conflict of interest, or anyone because of recruitment, advertising or financial considerations.</li>
</ul>
<h3>How to make a strong decision</h3>
<p>Look for a credible identity, a coherent biography, relevant subject knowledge, a clear and responsible writing purpose, and evidence that the applicant can contribute thoughtful journalism. Reject or leave unapproved anything suspicious, misleading or outside your confidence. Quality and integrity matter more than speed or volume.</p>
<h3>How Ground View News will support you</h3>
<p>Your dashboard shows only work assigned to you. If an application is unfamiliar, sensitive or outside your expertise, do not guess; allow reassignment and contact <a href="mailto:info@breccs.com">info@breccs.com</a> for guidance. Your submitted confidence and support feedback will help us improve training and tools.</p>
<p>Your existing writer access remains unchanged. Lead Editor status does not provide unrestricted administration, access to other writers' payment information, or authority to change editorial or financial policy. The separate 1.02 earnings-weighting stage is not active yet, and earnings are never guaranteed.</p>
<p>Thank you for helping Ground View News build a credible, active and supportive contributor community.</p>`
      : `<p>Thank you ${escapeHtml(writer.penName)}. We have recorded that you declined the Founding Lead Editor invitation.</p><p>Your writer account, publishing access and existing earnings are unchanged.</p>`,
    WRITER_EMAIL_FROM,
  );
  await sendEmail(
    JOURNALIST_APPROVAL_OWNER_EMAIL,
    `Founding Lead Editor invitation ${outcome}: ${writer.penName}`,
    `<p><strong>${escapeHtml(writer.fullName)}</strong> (${escapeHtml(writer.email)}) ${outcome} the Founding Lead Editor invitation.</p>
<p>Their optional confidence and support feedback is recorded securely in the platform.</p>`,
    WRITER_EMAIL_FROM,
  );

  if (body.response === 'decline') {
    const { data: promoted } = await service.rpc('maintain_founding_lead_editor_invitations', {
      p_max_places: 10,
      p_invitation_days: 14,
    });
    for (const row of promoted || []) await claimAndSendProgrammeNotification(service, row);
  }

  return NextResponse.json({ ok: true, membership });
}
