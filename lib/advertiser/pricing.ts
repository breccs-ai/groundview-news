/** Placement tier (visibility package). */
export type PlacementTier = 'basic' | 'standard' | 'premium';

/** Recurring billing cycle for new purchases. */
export type BillingCycle = 'monthly' | 'annual';

/** Legacy billing / format types (existing rows & Stripe metadata). */
export type AdFormat = 'leaderboard_banner' | 'sidebar_banner' | 'sponsored_article';
export type LegacyBillingTier = 'one_off' | 'monthly' | 'annual';
export type AdTier = LegacyBillingTier;

/** Annual discount: ~17.5% off effective monthly rate (within 15–20% target). */
export const ANNUAL_DISCOUNT_RATE = 0.175;

export const TIER_PRICING: Record<
  PlacementTier,
  { monthlyGbp: number; label: string; shortLabel: string }
> = {
  basic: { monthlyGbp: 89, label: 'Basic — Sidebar & Footer', shortLabel: 'Basic' },
  standard: { monthlyGbp: 149, label: 'Standard — Sidebar & In-Article', shortLabel: 'Standard' },
  premium: { monthlyGbp: 249, label: 'Premium — Homepage Featured + Full Placement', shortLabel: 'Premium' },
};

export const ANNUAL_INCENTIVES = [
  'Approximately 17.5% savings vs paying monthly',
  'Single upfront payment — no monthly renewals for 12 months',
  'Same placement benefits as the monthly plan for your tier',
  'Renewal reminders before your placement expires',
];

export function isPlacementTier(x: unknown): x is PlacementTier {
  return x === 'basic' || x === 'standard' || x === 'premium';
}

export function isBillingCycle(x: unknown): x is BillingCycle {
  return x === 'monthly' || x === 'annual';
}

export function getMonthlyPriceGbp(tier: PlacementTier): number {
  return TIER_PRICING[tier].monthlyGbp;
}

/** Total annual charge (12 × monthly × (1 − discount)). Never below 12 discounted months. */
export function getAnnualPriceGbp(tier: PlacementTier): number {
  const monthly = getMonthlyPriceGbp(tier);
  return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT_RATE) * 100) / 100;
}

/** Effective monthly rate when billed annually upfront. */
export function getAnnualEffectiveMonthlyGbp(tier: PlacementTier): number {
  return Math.round((getAnnualPriceGbp(tier) / 12) * 100) / 100;
}

export function getCheckoutPriceGbp(tier: PlacementTier, billingCycle: BillingCycle): number {
  return billingCycle === 'monthly' ? getMonthlyPriceGbp(tier) : getAnnualPriceGbp(tier);
}

const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function getMonthlyPriceLine(tier: PlacementTier): string {
  return `${gbp(getMonthlyPriceGbp(tier))}/month`;
}

export function getAnnualPriceLines(tier: PlacementTier): {
  annualTotal: string;
  effectiveMonthly: string;
  savingsPercent: number;
} {
  const annual = getAnnualPriceGbp(tier);
  const eff = getAnnualEffectiveMonthlyGbp(tier);
  return {
    annualTotal: `${gbp(annual)} billed annually`,
    effectiveMonthly: `${gbp(eff)}/month equivalent`,
    savingsPercent: Math.round(ANNUAL_DISCOUNT_RATE * 1000) / 10,
  };
}

export function getBillingPlanRadioCaption(tier: PlacementTier, billingCycle: BillingCycle): string {
  if (billingCycle === 'monthly') {
    return `${gbp(getMonthlyPriceGbp(tier))}/month, auto-renews`;
  }
  const lines = getAnnualPriceLines(tier);
  return `${lines.annualTotal} (${lines.effectiveMonthly})`;
}

export function getSelectionSummarySentence(tier: PlacementTier, billingCycle: BillingCycle): string {
  const name = TIER_PRICING[tier].shortLabel;
  if (billingCycle === 'monthly') {
    return `${name} — Monthly — ${getMonthlyPriceLine(tier)}, renews automatically. Cancel anytime from your dashboard.`;
  }
  const lines = getAnnualPriceLines(tier);
  return `${name} — Annual — ${lines.annualTotal} (${lines.effectiveMonthly}, ~${lines.savingsPercent}% vs monthly). Runs for 12 months from approval.`;
}

export function getBillingInclusionsLine(tier: PlacementTier, billingCycle: BillingCycle): string {
  if (billingCycle === 'monthly') {
    return 'Renews monthly until you cancel from your dashboard. Cancellation applies at the end of the billing period.';
  }
  return 'Single annual payment covers 12 months of placement. Renewal reminders are sent before expiry.';
}

// ---------------------------------------------------------------------------
// Legacy format × billing pricing (existing ads & backward-compatible paths)
// ---------------------------------------------------------------------------

export const AD_PRICING = {
  leaderboard_banner: {
    one_off: { price: 49, duration_days: 7, label: 'Leaderboard Banner — 7 Days' },
    monthly: { price: 249, label: 'Leaderboard Banner — Monthly' },
    annual: { price: 2469, label: 'Leaderboard Banner — Annual' },
  },
  sidebar_banner: {
    one_off: { price: 29, duration_days: 7, label: 'Sidebar Banner — 7 Days' },
    monthly: { price: 89, label: 'Sidebar Banner — Monthly' },
    annual: { price: 882, label: 'Sidebar Banner — Annual' },
  },
  sponsored_article: {
    one_off: { price: 99, label: 'Sponsored Article — One Off' },
    monthly: { price: 149, label: 'Sponsored Article — Monthly' },
    annual: { price: 1479, label: 'Sponsored Article — Annual' },
  },
} as const;

export const FORMAT_DISPLAY_LABELS: Record<AdFormat, string> = {
  leaderboard_banner: 'Leaderboard Banner',
  sidebar_banner: 'Sidebar Banner',
  sponsored_article: 'Sponsored Article',
};

export const AD_TYPE_DESCRIPTIONS: Record<AdFormat, string> = {
  leaderboard_banner: 'Full-width banner displayed at the top of every page',
  sidebar_banner: 'Compact banner displayed in the article sidebar',
  sponsored_article: 'Your content published as a clearly labelled sponsored article',
};

export function getAdPriceGbp(format: AdFormat, tier: LegacyBillingTier): number {
  return AD_PRICING[format][tier].price;
}

export function getOneOffDurationDays(format: AdFormat): number {
  const row = AD_PRICING[format].one_off;
  return 'duration_days' in row ? row.duration_days : 7;
}

export function getTierPriceLine(format: AdFormat, tier: LegacyBillingTier): string {
  const row = AD_PRICING[format][tier];
  if (tier === 'one_off') {
    const days = getOneOffDurationDays(format);
    return `${gbp(row.price)} / ${days} days`;
  }
  if (tier === 'monthly') return `${gbp(row.price)}/month`;
  return `${gbp(row.price)}/year`;
}

export function getBillingPlanDisplayName(tier: LegacyBillingTier): string {
  if (tier === 'one_off') return 'One-off';
  if (tier === 'monthly') return 'Monthly';
  return 'Annual';
}

export function getBillingPlanFormalName(tier: LegacyBillingTier): string {
  if (tier === 'one_off') return 'One-off Plan';
  if (tier === 'monthly') return 'Monthly Plan';
  return 'Annual Plan';
}

/** Map legacy format to placement tier for display eligibility. */
export function placementTierFromFormat(format: string): PlacementTier {
  if (format === 'leaderboard_banner') return 'premium';
  if (format === 'sponsored_article') return 'standard';
  return 'basic';
}

/** Resolve placement tier from a DB row (supports legacy and new models). */
export function resolvePlacementTier(row: { tier?: string | null; format?: string | null }): PlacementTier {
  if (isPlacementTier(row.tier)) return row.tier;
  return placementTierFromFormat(String(row.format || 'sidebar_banner'));
}

/** Resolve billing cycle from a DB row. */
export function resolveBillingCycle(row: { billing_cycle?: string | null; tier?: string | null }): string {
  if (row.billing_cycle) return row.billing_cycle;
  const t = row.tier;
  if (t === 'one_off' || t === 'monthly' || t === 'annual') return t;
  return 'monthly';
}
