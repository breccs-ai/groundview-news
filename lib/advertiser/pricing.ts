export const AD_PRICING = {
  leaderboard_banner: {
    one_off: { price: 49, duration_days: 7, label: 'Leaderboard Banner — 7 Days' },
    monthly: { price: 149, label: 'Leaderboard Banner — Monthly' },
    annual: { price: 1199, label: 'Leaderboard Banner — Annual' },
  },
  sidebar_banner: {
    one_off: { price: 29, duration_days: 7, label: 'Sidebar Banner — 7 Days' },
    monthly: { price: 89, label: 'Sidebar Banner — Monthly' },
    annual: { price: 719, label: 'Sidebar Banner — Annual' },
  },
  sponsored_article: {
    one_off: { price: 99, label: 'Sponsored Article — One Off' },
    monthly: { price: 249, label: 'Sponsored Article — Monthly (2 per month)' },
    annual: { price: 1999, label: 'Sponsored Article — Annual (up to 3 per month)' },
  },
} as const;

export type AdFormat = keyof typeof AD_PRICING;
export type AdTier = 'one_off' | 'monthly' | 'annual';

export const ANNUAL_INCENTIVES = [
  'Priority ad placement',
  'Monthly performance report',
  'Dedicated account email support',
  'First right of renewal before slots open publicly',
];

export function getAdPriceGbp(format: AdFormat, tier: AdTier): number {
  const row = AD_PRICING[format][tier];
  return row.price;
}

export function getOneOffDurationDays(format: AdFormat): number {
  const row = AD_PRICING[format].one_off;
  return 'duration_days' in row ? row.duration_days : 7;
}

/** Human-readable format names for UI (create-ad, checkout copy, etc.). */
export const FORMAT_DISPLAY_LABELS: Record<AdFormat, string> = {
  leaderboard_banner: 'Leaderboard Banner',
  sidebar_banner: 'Sidebar Banner',
  sponsored_article: 'Sponsored Article',
};

/** One-line placement description per ad type (create-ad UI). */
export const AD_TYPE_DESCRIPTIONS: Record<AdFormat, string> = {
  leaderboard_banner: 'Full-width banner displayed at the top of every page',
  sidebar_banner: 'Compact banner displayed in the article sidebar',
  sponsored_article: 'Your content published as a clearly labelled sponsored article',
};

const gbp = (n: number) => `£${n.toLocaleString('en-GB')}`;

/** Short price line for a format + tier (e.g. "£49 / 7 days", "£149/month"). */
export function getTierPriceLine(format: AdFormat, tier: AdTier): string {
  const row = AD_PRICING[format][tier];
  if (tier === 'one_off') {
    const days = getOneOffDurationDays(format);
    return `${gbp(row.price)} / ${days} days`;
  }
  if (tier === 'monthly') return `${gbp(row.price)}/month`;
  return `${gbp(row.price)}/year`;
}

/** Caption next to each billing-plan radio for the selected ad type. */
export function getBillingPlanRadioCaption(format: AdFormat, tier: AdTier): string {
  if (tier === 'one_off') {
    const days = getOneOffDurationDays(format);
    return `${gbp(getAdPriceGbp(format, 'one_off'))} for ${days} days`;
  }
  if (tier === 'monthly') return `${gbp(getAdPriceGbp(format, 'monthly'))}/month, auto-renews`;
  return `${gbp(getAdPriceGbp(format, 'annual'))}/year, auto-renews + priority placement`;
}

export function getBillingPlanDisplayName(tier: AdTier): string {
  if (tier === 'one_off') return 'One-off';
  if (tier === 'monthly') return 'Monthly';
  return 'Annual';
}

export function getBillingPlanFormalName(tier: AdTier): string {
  if (tier === 'one_off') return 'One-off Plan';
  if (tier === 'monthly') return 'Monthly Plan';
  return 'Annual Plan';
}

/** Human-readable inclusion / renewal line for the summary box. */
export function getBillingInclusionsLine(format: AdFormat, tier: AdTier): string {
  if (tier === 'one_off') {
    const d = getOneOffDurationDays(format);
    return `Placement runs for ${d} days from approval once your ad is live.`;
  }
  if (tier === 'monthly') {
    return 'Renews monthly until you cancel from your dashboard. Cancellation applies at the end of the billing period. No partial refunds.';
  }
  return 'Renews annually until you cancel from your dashboard; includes priority placement and annual subscriber benefits. Cancellation applies at the end of the billing period. No partial refunds.';
}

/** Example-style single sentence for confirmation UI. */
export function getSelectionSummarySentence(format: AdFormat, tier: AdTier): string {
  const name = FORMAT_DISPLAY_LABELS[format];
  const plan = getBillingPlanFormalName(tier);
  if (tier === 'one_off') {
    const p = getAdPriceGbp(format, 'one_off');
    const d = getOneOffDurationDays(format);
    return `${name} — ${plan} — ${gbp(p)} for ${d} days from approval once your ad is live.`;
  }
  if (tier === 'monthly') {
    return `${name} — ${plan} — ${gbp(getAdPriceGbp(format, 'monthly'))}/month, renews automatically. Cancel anytime from your dashboard.`;
  }
  return `${name} — ${plan} — ${gbp(getAdPriceGbp(format, 'annual'))}/year, renews automatically with priority placement. Cancel anytime from your dashboard.`;
}
