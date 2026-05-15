import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { isAdminServerSession } from '@/lib/admin-server';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

const KYC_BUCKET = 'kyc-documents';
const SIGNED_URL_TTL_SEC = 60 * 60;

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function GET(req: NextRequest) {
  if (!isAdminServerSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const profileId = req.nextUrl.searchParams.get('profile_id');
  const signedUrl = req.nextUrl.searchParams.get('signed_url');

  if (profileId && signedUrl === '1') {
    const { data: profile, error } = await service
      .from('advertiser_profiles')
      .select('kyc_document_url')
      .eq('id', profileId)
      .maybeSingle();

    if (error || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const path = (profile as { kyc_document_url: string | null }).kyc_document_url;
    if (!path) {
      return NextResponse.json({ error: 'No document on file' }, { status: 404 });
    }

    const { data: signed, error: signErr } = await service.storage
      .from(KYC_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SEC);

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ error: signErr?.message || 'Could not generate URL' }, { status: 500 });
    }

    return NextResponse.json({ url: signed.signedUrl });
  }

  const { data, error } = await service
    .from('advertiser_profiles')
    .select('id, company_name, email, kyc_submitted_at, kyc_document_url, kyc_document_name')
    .eq('kyc_status', 'pending_review')
    .order('kyc_submitted_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: NextRequest) {
  if (!isAdminServerSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: 'approve' | 'reject';
    profile_id?: string;
    reason?: string;
  };

  const { action, profile_id: profileId, reason } = body;
  if (!profileId || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (action === 'reject' && (!reason || reason.trim().length < 3)) {
    return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
  }

  const { data: profile, error: fetchErr } = await service
    .from('advertiser_profiles')
    .select('id, email, company_name, kyc_status')
    .eq('id', profileId)
    .maybeSingle();

  if (fetchErr || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const row = profile as { id: string; email: string; company_name: string; kyc_status: string };
  if (row.kyc_status !== 'pending_review') {
    return NextResponse.json({ error: 'Profile is not pending review' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const reviewedBy = 'admin';

  if (action === 'approve') {
    const { error: updateErr } = await service
      .from('advertiser_profiles')
      .update({
        kyc_status: 'verified',
        stripe_identity_verified: true,
        kyc_verified_at: now,
        kyc_reviewed_at: now,
        kyc_reviewed_by: reviewedBy,
        updated_at: now,
      })
      .eq('id', profileId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await sendEmail(
      row.email,
      'Your Ground View News advertiser account is verified',
      `<p>Your identity has been verified. You can now log in and place advertisements on Ground View News.</p>
       <p>Visit your dashboard: <a href="https://groundviewnews.com/advertiser/dashboard">https://groundviewnews.com/advertiser/dashboard</a></p>`
    );

    return NextResponse.json({ ok: true, kyc_status: 'verified' });
  }

  const rejectionReason = reason!.trim();
  const { error: updateErr } = await service
    .from('advertiser_profiles')
    .update({
      kyc_status: 'failed',
      kyc_reviewed_at: now,
      kyc_reviewed_by: reviewedBy,
      updated_at: now,
    })
    .eq('id', profileId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await sendEmail(
    row.email,
    'Identity verification unsuccessful — Ground View News',
    `<p>Unfortunately we were unable to verify your identity with the document provided.</p>
     <p><strong>Reason:</strong> ${escapeHtml(rejectionReason)}</p>
     <p>Please log in and resubmit a valid identity document.</p>`
  );

  return NextResponse.json({ ok: true, kyc_status: 'failed' });
}
