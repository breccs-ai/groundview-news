import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { isAdminServerSession } from '@/lib/admin-server';
import { sendEmail } from '@/lib/email';
import { WRITER_EMAIL_FROM, escapeHtml } from '@/lib/writer-emails';

const TRANSITIONS: Record<string, string[]> = {
  requested: ['processing', 'rejected'],
  processing: ['paid', 'failed'],
  failed: ['processing', 'rejected'],
};

export async function GET() {
  if (!isAdminServerSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const service = getServiceSupabase();
  if (!service) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

  const { data: requests, error } = await service
    .from('writer_payment_requests')
    .select('*')
    .order('requested_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const writerIds = Array.from(new Set((requests || []).map((row) => String(row.journalist_id))));
  const [profilesResult, payoutResult] = await Promise.all([
    writerIds.length
      ? service.from('profiles').select('id, full_name, pen_name, email').in('id', writerIds)
      : Promise.resolve({ data: [], error: null }),
    writerIds.length
      ? service.from('writer_payout_profiles').select('*').in('journalist_id', writerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error || payoutResult.error) {
    return NextResponse.json({ error: profilesResult.error?.message || payoutResult.error?.message }, { status: 400 });
  }

  const profiles = new Map((profilesResult.data || []).map((row) => [String(row.id), row]));
  const payouts = new Map((payoutResult.data || []).map((row) => [String(row.journalist_id), row]));
  return NextResponse.json({
    rows: (requests || []).map((request) => ({
      ...request,
      writer: profiles.get(String(request.journalist_id)) || null,
      payout_profile: request.payout_snapshot || payouts.get(String(request.journalist_id)) || null,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  if (!isAdminServerSession()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const service = getServiceSupabase();
  if (!service) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id || '').trim();
  const nextStatus = String(body.status || '').trim();
  const adminNote = String(body.admin_note || '').trim();
  const reference = String(body.transaction_reference || '').trim();
  if (!id || !nextStatus || adminNote.length > 1000 || reference.length > 200) {
    return NextResponse.json({ error: 'Invalid payment update.' }, { status: 400 });
  }

  const { data: current } = await service
    .from('writer_payment_requests')
    .select('id, journalist_id, amount, currency, status')
    .eq('id', id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: 'Payment request not found.' }, { status: 404 });
  if (!(TRANSITIONS[String(current.status)] || []).includes(nextStatus)) {
    return NextResponse.json({ error: `Cannot change ${current.status} to ${nextStatus}.` }, { status: 400 });
  }
  if (nextStatus === 'paid' && !reference) {
    return NextResponse.json({ error: 'A transaction reference is required when marking paid.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: nextStatus,
    admin_note: adminNote || null,
    transaction_reference: reference || null,
    updated_at: now,
  };
  if (nextStatus === 'processing') update.processing_at = now;
  if (nextStatus === 'paid') {
    update.paid_at = now;
    update.resolved_at = now;
  }
  if (nextStatus === 'rejected' || nextStatus === 'failed') update.resolved_at = now;

  const { error } = await service.from('writer_payment_requests').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: profile } = await service
    .from('profiles')
    .select('email, full_name, pen_name')
    .eq('id', current.journalist_id)
    .maybeSingle();
  if (profile?.email) {
    const amount = new Intl.NumberFormat('en-GB', { style: 'currency', currency: current.currency || 'GBP' }).format(Number(current.amount));
    await sendEmail(
      profile.email,
      `Payment request ${nextStatus} — Ground View News`,
      `<p>Hi ${escapeHtml(profile.pen_name || profile.full_name || 'there')},</p><p>Your payment request for <strong>${escapeHtml(amount)}</strong> is now <strong>${escapeHtml(nextStatus)}</strong>.</p>${reference ? `<p>Transaction reference: <strong>${escapeHtml(reference)}</strong></p>` : ''}${adminNote ? `<p>${escapeHtml(adminNote)}</p>` : ''}`,
      WRITER_EMAIL_FROM
    );
  }

  return NextResponse.json({ ok: true });
}
