import type { PlacementTier } from '@/lib/advertiser/pricing';

/** Public display zones across the site. */
export type AdZone =
  | 'homepage_featured'
  | 'homepage_sidebar'
  | 'article_in_content'
  | 'article_sidebar'
  | 'footer';

export const ZONE_LABELS: Record<AdZone, string> = {
  homepage_featured: 'Homepage featured',
  homepage_sidebar: 'Homepage sidebar',
  article_in_content: 'In-article',
  article_sidebar: 'Article sidebar',
  footer: 'Footer banner',
};

/** Which placement tiers may appear in each zone. */
export function tierEligibleForZone(tier: PlacementTier, zone: AdZone): boolean {
  switch (zone) {
    case 'homepage_featured':
      return tier === 'premium';
    case 'article_in_content':
      return tier === 'standard' || tier === 'premium';
    case 'homepage_sidebar':
    case 'article_sidebar':
    case 'footer':
      return true;
    default:
      return false;
  }
}

/** Rotation weight — higher tiers surface more often in shared pools. */
export function rotationWeight(tier: PlacementTier): number {
  if (tier === 'premium') return 3;
  if (tier === 'standard') return 2;
  return 1;
}

/** Derive legacy format column from placement tier (for existing integrations). */
export function formatForPlacementTier(tier: PlacementTier): string {
  if (tier === 'premium') return 'leaderboard_banner';
  if (tier === 'standard') return 'sponsored_article';
  return 'sidebar_banner';
}

export const PLACEMENT_TIER_DESCRIPTIONS: Record<PlacementTier, string> = {
  basic: 'Sidebar and footer rotation across the site',
  standard: 'Sidebar placement plus in-article mid-content slot on article pages',
  premium: 'Homepage featured hero slot, sidebar, and in-article placement',
};

export const PLACEMENT_TIER_NAMES: Record<PlacementTier, string> = {
  basic: 'Basic',
  standard: 'Standard',
  premium: 'Premium',
};
