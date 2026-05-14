import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServiceSupabase } from '@/lib/supabase-service';
import { kyc_approved, kyc_failed } from '@/lib/emails/advertiser-emails';

export const runtime = 'nodejs';

function getStripe(): Stripe | null {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) return null;
  return new Stripe(k);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !sig) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
  }
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    console.error('[kyc/webhook] signature', e);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (event.type === 'identity.verification_session.verified') {
    const session = event.data.object as Stripe.Identity.VerificationSession;
    const meta = session.metadata || {};
    const profileId = typeof meta.advertiser_profile_id === 'string' ? meta.advertiser_profile_id : '';

    const baseUpdate = {
      kyc_status: 'verified',
      stripe_identity_verified: true,
      kyc_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: updated } = profileId
      ? await supabase
          .from('advertiser_profiles')
          .update(baseUpdate)
          .eq('id', profileId)
          .select('contact_name, email, company_name')
          .maybeSingle()
      : await supabase
          .from('advertiser_profiles')
          .update(baseUpdate)
          .eq('stripe_identity_session_id', session.id)
          .select('contact_name, email, company_name')
          .maybeSingle();

    const u = updated as { contact_name?: string; email?: string; company_name?: string } | null;
    const name = String(u?.contact_name || u?.company_name || 'Advertiser');
    const email = String(u?.email || '');
    if (email) await kyc_approved(name, email);
  }

  if (event.type === 'identity.verification_session.requires_input') {
    const session = event.data.object as Stripe.Identity.VerificationSession;
    const lastError = session.last_error?.reason || '';

    const { data: updated } = await supabase
      .from('advertiser_profiles')
      .update({
        kyc_status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_identity_session_id', session.id)
      .select('contact_name, email, company_name')
      .maybeSingle();

    const u = updated as { contact_name?: string; email?: string; company_name?: string } | null;
    const name = String(u?.contact_name || u?.company_name || 'Advertiser');
    const email = String(u?.email || '');
    if (email) await kyc_failed(name, email, lastError || undefined);
  }

  return NextResponse.json({ received: true });
}
