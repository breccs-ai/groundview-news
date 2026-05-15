import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServiceSupabase } from '@/lib/supabase-service';

export const runtime = 'nodejs';

function getStripe(): Stripe | null {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) return null;
  return new Stripe(k);
}

function bearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization');
  if (!h?.toLowerCase().startsWith('bearer ')) return null;
  return h.slice(7).trim() || null;
}

export async function POST(req: NextRequest) {
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = getServiceSupabase();
  const stripe = getStripe();
  if (!service || !stripe) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const {
    data: { user },
    error: authErr,
  } = await service.auth.getUser(token);
  if (authErr || !user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: pErr } = await service
    .from('advertiser_profiles')
    .select('id, email, stripe_identity_session_id, kyc_status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (pErr || !profile) {
    return NextResponse.json({ error: 'Advertiser profile not found. Complete registration first.' }, { status: 400 });
  }

  const row = profile as { id: string; email: string };
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://groundviewnews.com';

  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    options: {
      document: {
        allowed_types: ['driving_license', 'passport', 'id_card'],
        require_id_number: true,
        require_live_capture: true,
      },
    },
    metadata: {
      advertiser_email: row.email,
      user_id: user.id,
      advertiser_profile_id: row.id,
    } as Record<string, string>,
    flow: 'vf_1TXM7GCAw3fTEUks3wAZcI3b',
    return_url: `${baseUrl.replace(/\/$/, '')}/advertiser/dashboard?kyc=return`,
  });

  await service
    .from('advertiser_profiles')
    .update({
      stripe_identity_session_id: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  if (!session.client_secret) {
    return NextResponse.json({ error: 'Stripe did not return client_secret' }, { status: 500 });
  }

  return NextResponse.json({ client_secret: session.client_secret });
}
