import { NextRequest, NextResponse } from 'next/server';
import { getStripe, siteBase } from '@/lib/stripe';
import { getServiceSupabase } from '@/lib/supabase-service';
import { computeExpiry, getProfileByEmail } from '@/lib/subscription';

export const runtime = 'nodejs';

/**
 * GET /api/subscribe/success?session_id=cs_...
 *
 * Reached after Stripe redirects the buyer back from hosted Checkout. Acts
 * as a defensive upsert layer in case the webhook hasn't processed yet, so
 * the success page can confidently tell the reader "you're a subscriber now".
 *
 * Final user-visible response is a 302 to /subscribe/success. Database write
 * here is best-effort; the Stripe webhook remains the source of truth.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');
  const failureRedirect = NextResponse.redirect(`${siteBase()}/subscribe?error=missing_session`, 302);

  if (!sessionId) return failureRedirect;

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.redirect(`${siteBase()}/subscribe?error=stripe_unavailable`, 302);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return NextResponse.redirect(`${siteBase()}/subscribe?error=payment_incomplete`, 302);
    }

    const meta = session.metadata || {};
    const plan = (meta.plan === 'annual' ? 'annual' : 'monthly') as 'monthly' | 'annual';
    const email =
      (typeof session.customer_details?.email === 'string' && session.customer_details.email) ||
      (typeof session.customer_email === 'string' && session.customer_email) ||
      '';

    const supabase = getServiceSupabase();
    if (supabase && email) {
      const profile = await getProfileByEmail(supabase, email);
      if (profile) {
        const startedAt = new Date();
        const expiresAt = computeExpiry(plan, startedAt);
        const stripeCustomerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'active',
            subscription_plan: plan,
            subscription_started_at: startedAt.toISOString(),
            subscription_expires_at: expiresAt.toISOString(),
            ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
          })
          .eq('id', profile.id);
      }
      // If profile doesn't exist yet the webhook will provision it. The
      // success page itself does not depend on the DB write having landed.
    }

    return NextResponse.redirect(`${siteBase()}/subscribe/success?session_id=${sessionId}`, 302);
  } catch (e) {
    console.error('[subscribe/success]', e);
    return NextResponse.redirect(`${siteBase()}/subscribe?error=verify_failed`, 302);
  }
}
