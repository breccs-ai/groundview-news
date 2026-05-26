import Stripe from 'stripe';

/**
 * Shared Stripe client and reader-subscription price lookup.
 *
 * Two products back the reader subscription flow:
 *   - "Ground View News Monthly" → £4.99/month, mode=subscription (recurring)
 *   - "Ground View News Annual"  → £39/year,   mode=payment      (one-off)
 *
 * Operators can pin specific Stripe Price IDs via env vars:
 *   STRIPE_PRICE_READER_MONTHLY
 *   STRIPE_PRICE_READER_ANNUAL
 *
 * If those env vars are not set, this module looks up (or creates) the
 * matching Product+Price by canonical name on first call, so a fresh Stripe
 * account works without any manual dashboard setup. Idempotent: subsequent
 * calls re-use the discovered Price ID via an in-process cache.
 */

const MONTHLY_PRODUCT_NAME = 'Ground View News Monthly';
const ANNUAL_PRODUCT_NAME = 'Ground View News Annual';

const MONTHLY_AMOUNT_PENCE = 499;
const ANNUAL_AMOUNT_PENCE = 3900;
const CURRENCY = 'gbp';

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  stripeSingleton = new Stripe(key);
  return stripeSingleton;
}

// In-process cache; safe to share across requests in the same Node process.
const priceCache = new Map<'monthly' | 'annual', string>();

async function findOrCreateProduct(stripe: Stripe, name: string): Promise<Stripe.Product> {
  const search = await stripe.products.search({ query: `active:'true' AND name:'${name}'`, limit: 1 });
  if (search.data[0]) return search.data[0];
  return stripe.products.create({
    name,
    metadata: { gvn_product: 'reader_subscription' },
  });
}

async function findOrCreatePrice(
  stripe: Stripe,
  product: Stripe.Product,
  unitAmount: number,
  recurring: Stripe.PriceCreateParams.Recurring | undefined,
): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
  const wantRecurringInterval = recurring?.interval ?? null;
  const match = prices.data.find((p) => {
    if (p.currency !== CURRENCY) return false;
    if (p.unit_amount !== unitAmount) return false;
    const pInterval = p.recurring?.interval ?? null;
    return pInterval === wantRecurringInterval;
  });
  if (match) return match;
  return stripe.prices.create({
    product: product.id,
    currency: CURRENCY,
    unit_amount: unitAmount,
    ...(recurring ? { recurring } : {}),
  });
}

export async function getMonthlyPriceId(): Promise<string> {
  const cached = priceCache.get('monthly');
  if (cached) return cached;
  const env = process.env.STRIPE_PRICE_READER_MONTHLY;
  if (env) {
    priceCache.set('monthly', env);
    return env;
  }
  const stripe = getStripe();
  const product = await findOrCreateProduct(stripe, MONTHLY_PRODUCT_NAME);
  const price = await findOrCreatePrice(stripe, product, MONTHLY_AMOUNT_PENCE, { interval: 'month' });
  priceCache.set('monthly', price.id);
  return price.id;
}

export async function getAnnualPriceId(): Promise<string> {
  const cached = priceCache.get('annual');
  if (cached) return cached;
  const env = process.env.STRIPE_PRICE_READER_ANNUAL;
  if (env) {
    priceCache.set('annual', env);
    return env;
  }
  const stripe = getStripe();
  const product = await findOrCreateProduct(stripe, ANNUAL_PRODUCT_NAME);
  const price = await findOrCreatePrice(stripe, product, ANNUAL_AMOUNT_PENCE, undefined);
  priceCache.set('annual', price.id);
  return price.id;
}

/** Site base URL used for Stripe success/cancel redirects. */
export function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://groundviewnews.com').replace(/\/$/, '');
}

export const READER_SUBSCRIPTION_METADATA_KEY = 'purpose';
export const READER_SUBSCRIPTION_METADATA_VALUE = 'reader_subscription';

export type ReaderSubscriptionPlan = 'monthly' | 'annual';
