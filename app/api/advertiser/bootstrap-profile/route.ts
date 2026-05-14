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

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const company_name = typeof body.company_name === 'string' ? body.company_name.trim() : '';
  const contact_name = typeof body.contact_name === 'string' ? body.contact_name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const website = typeof body.website === 'string' ? body.website.trim() : '';
  const country = typeof body.country === 'string' ? body.country.trim() : '';

  if (!company_name || !contact_name || !email || !country) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (user.email && email && user.email.toLowerCase() !== email) {
    return NextResponse.json({ error: 'Email must match your account email' }, { status: 400 });
  }

  const emailNorm = (user.email || email).toLowerCase();

  const { data: existing } = await service
    .from('advertiser_profiles')
    .select('id, stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; stripe_customer_id: string | null };
    return NextResponse.json({
      advertiser_profile_id: row.id,
      stripe_customer_id: row.stripe_customer_id,
      already_exists: true,
    });
  }

  const { error: rpcErr } = await service.rpc('append_profile_advertiser_role', { p_id: user.id });
  if (rpcErr) {
    const { data: prof } = await service.from('profiles').select('roles, role').eq('id', user.id).maybeSingle();
    const pr = prof as { roles?: string[] | null; role?: string | null } | null;
    const rolesArr = [...(pr?.roles || []).map(String)];
    if (!rolesArr.includes('advertiser')) rolesArr.push('advertiser');
    await service.from('profiles').update({ roles: rolesArr }).eq('id', user.id);
  }

  let stripeCustomerId: string | null = null;
  try {
    const customer = await stripe.customers.create({
      email: emailNorm,
      name: company_name,
      metadata: { user_id: user.id },
    });
    stripeCustomerId = customer.id;
  } catch (e) {
    console.error('[bootstrap-profile] stripe customer', e);
    return NextResponse.json({ error: 'Could not create billing customer' }, { status: 500 });
  }

  const { data: inserted, error: insErr } = await service
    .from('advertiser_profiles')
    .insert({
      user_id: user.id,
      company_name,
      contact_name,
      email: emailNorm,
      phone: phone || null,
      website: website || null,
      country,
      stripe_customer_id: stripeCustomerId,
    })
    .select('id')
    .single();

  if (insErr || !inserted) {
    console.error('[bootstrap-profile]', insErr?.message);
    return NextResponse.json({ error: insErr?.message || 'Insert failed' }, { status: 400 });
  }

  await service
    .from('profiles')
    .update({ email: emailNorm, full_name: contact_name })
    .eq('id', user.id);

  return NextResponse.json({
    advertiser_profile_id: (inserted as { id: string }).id,
    stripe_customer_id: stripeCustomerId,
    already_exists: false,
  });
}
