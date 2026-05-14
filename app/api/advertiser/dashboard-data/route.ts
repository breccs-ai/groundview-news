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

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://groundviewnews.com').replace(/\/$/, '');
}

export async function GET(req: NextRequest) {
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = getServiceSupabase();
  const stripe = getStripe();
  if (!service) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

  const {
    data: { user },
    error: authErr,
  } = await service.auth.getUser(token);
  if (authErr || !user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await service
    .from('advertiser_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ profile: null, ads: [], invoices: [] });
  }

  const prof = profile as { id: string; stripe_customer_id: string | null };

  const { data: ads } = await service
    .from('advertisements')
    .select(
      'id, title, status, format, tier, expires_at, starts_at, view_count, click_count, ai_review_status, stripe_subscription_id, price_gbp, created_at'
    )
    .eq('advertiser_id', prof.id)
    .order('created_at', { ascending: false });

  let invoices: Stripe.Invoice[] = [];
  if (stripe && prof.stripe_customer_id) {
    try {
      const list = await stripe.invoices.list({ customer: prof.stripe_customer_id, limit: 24 });
      invoices = list.data;
    } catch (e) {
      console.error('[dashboard-data] invoices', e);
    }
  }

  return NextResponse.json({
    profile,
    ads: ads || [],
    invoices: invoices.map((inv) => ({
      id: inv.id,
      status: inv.status,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      created: inv.created,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
    })),
    billing_portal_url: `${siteBase()}/api/advertiser/billing-portal`,
  });
}
