import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';

const KYC_BUCKET = 'kyc-documents';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function bearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization');
  if (!h?.toLowerCase().startsWith('bearer ')) return null;
  return h.slice(7).trim() || null;
}

function safeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return base || 'document';
}

export async function POST(req: NextRequest) {
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const {
    data: { user },
    error: authErr,
  } = await service.auth.getUser(token);
  if (authErr || !user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Use JPEG, PNG, WebP, or PDF.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 });
  }

  const { data: profile, error: pErr } = await service
    .from('advertiser_profiles')
    .select('id, email, company_name, kyc_status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (pErr || !profile) {
    return NextResponse.json(
      { error: 'Advertiser profile not found. Complete registration first.' },
      { status: 400 }
    );
  }

  const row = profile as {
    id: string;
    email: string;
    company_name: string;
    kyc_status: string;
  };

  if (row.kyc_status === 'verified') {
    return NextResponse.json({ error: 'Identity already verified' }, { status: 400 });
  }

  const originalName = file.name || 'document';
  const storagePath = `${user.id}/${Date.now()}_${safeFilename(originalName)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let { error: upErr } = await service.storage.from(KYC_BUCKET).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (upErr) {
    await service.storage.createBucket(KYC_BUCKET, { public: false }).catch(() => {});
    const retry = await service.storage.from(KYC_BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
    upErr = retry.error;
  }

  if (upErr) {
    console.error('[kyc-upload] storage upload failed', upErr);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await service
    .from('advertiser_profiles')
    .update({
      kyc_document_url: storagePath,
      kyc_document_name: originalName,
      kyc_submitted_at: now,
      kyc_status: 'pending_review',
      updated_at: now,
    })
    .eq('id', row.id);

  if (updateErr) {
    console.error('[kyc-upload] profile update failed', updateErr);
    await service.storage.from(KYC_BUCKET).remove([storagePath]).catch(() => {});
    return NextResponse.json({ error: 'Could not save submission' }, { status: 500 });
  }

  const company = row.company_name || 'Advertiser';
  const email = row.email;

  await sendEmail(
    'info@groundviewnews.com',
    'KYC Document Submitted — Action Required',
    `<p>Advertiser ${escapeHtml(company)} (${escapeHtml(email)}) has submitted their identity document for review. Please log in to the admin dashboard to review and approve.</p>`
  );

  await sendEmail(
    email,
    'Your identity document has been received — Ground View News',
    `<p>Thank you for submitting your identity document. Our team will review it within 1-2 business days and notify you by email once your account is verified. You will then be able to place advertisements on Ground View News.</p>`
  );

  return NextResponse.json({ success: true, status: 'pending_review' });
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
