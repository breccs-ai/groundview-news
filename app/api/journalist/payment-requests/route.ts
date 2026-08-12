import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-service';
import { getApprovedWriter } from '@/lib/writer-server-auth';
import { sendEmail } from '@/lib/email';
import { WRITER_EMAIL_FROM, escapeHtml } from '@/lib/writer-emails';

export async function POST(req: NextRequest) {
  const writer = await getApprovedWriter(req);
  if (!writer) return NextResponse.json({ error: 'Approved writer access required.' }, { status: 403 });
  const service = getServiceSupabase();
  if (!service) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as { amount?: unknown; note?: unknown };
  const amount = Number(body.amount);
  const note = String(body.note || '').trim();
  if (!Number.isFinite(amount) || amount <= 0 || note.length > 500) {
    return NextResponse.json({ error: 'Enter a valid payment request.' }, { status: 400 });
  }

  const { data: setting } = await service
    .from('site_settings')
    .select('value')
    .eq('key', 'writer_payment_minimum_gbp')
    .maybeSingle();
  const configuredMinimum = Number((setting as { value?: unknown } | null)?.value);
  const minimum = Number.isFinite(configuredMinimum) ? configuredMinimum : 25;

  const { data, error } = await service.rpc('create_writer_payment_request', {
    p_journalist_id: writer.id,
    p_amount: Math.round(amount * 100) / 100,
    p_minimum: minimum,
    p_writer_note: note || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await Promise.all([
    sendEmail(
      writer.email,
      'Payment request received — Ground View News',
      `<p>Hi ${escapeHtml(writer.penName || writer.fullName)},</p><p>We received your payment request for <strong>£${amount.toFixed(2)}</strong>. You can follow its status in your writer dashboard.</p>`,
      WRITER_EMAIL_FROM
    ),
    sendEmail(
      'info@groundviewnews.com',
      'Writer payment request received',
      `<p><strong>${escapeHtml(writer.penName || writer.fullName)}</strong> requested <strong>£${amount.toFixed(2)}</strong>.</p><p>Open the admin Revenue page for their verified remittance instructions.</p>`,
      WRITER_EMAIL_FROM
    ),
  ]);

  return NextResponse.json({ ok: true, request: data });
}
