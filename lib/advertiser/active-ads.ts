import { getServiceSupabase } from '@/lib/supabase-service';
import { tierEligibleForZone, rotationWeight, type AdZone } from '@/lib/advertiser/placements';
import { resolvePlacementTier } from '@/lib/advertiser/pricing';

export type ActiveAd = {
  id: string;
  title: string;
  body_text: string | null;
  destination_url: string;
  image_url: string | null;
  tier: string;
  format: string | null;
};

function isNotExpired(row: Record<string, unknown>, now: Date): boolean {
  const expiryDate = row.expiry_date ? String(row.expiry_date) : null;
  if (expiryDate) {
    const d = new Date(`${expiryDate}T23:59:59.999Z`);
    if (!Number.isNaN(d.getTime()) && d < now) return false;
  }
  const expiresAt = row.expires_at ? new Date(String(row.expires_at)) : null;
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt < now) return false;
  const endsAt = row.ends_at ? new Date(String(row.ends_at)) : null;
  if (endsAt && !Number.isNaN(endsAt.getTime()) && endsAt < now) return false;
  return true;
}

/** Fetch active, non-expired ads eligible for a display zone. */
export async function fetchActiveAdsForZone(zone: AdZone): Promise<ActiveAd[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];

  const now = new Date();
  const { data, error } = await supabase
    .from('advertisements')
    .select('id, title, body_text, destination_url, image_url, tier, format, expires_at, ends_at, expiry_date')
    .eq('status', 'active')
    .eq('ai_review_status', 'passed');

  if (error || !data) return [];

  return (data as Record<string, unknown>[])
    .filter((row) => isNotExpired(row, now))
    .filter((row) => {
      const placementTier = resolvePlacementTier({
        tier: row.tier as string,
        format: row.format as string,
      });
      return tierEligibleForZone(placementTier, zone);
    })
    .map((row) => ({
      id: String(row.id),
      title: String(row.title || ''),
      body_text: row.body_text != null ? String(row.body_text) : null,
      destination_url: String(row.destination_url || ''),
      image_url: row.image_url != null ? String(row.image_url) : null,
      tier: String(row.tier || 'basic'),
      format: row.format != null ? String(row.format) : null,
    }));
}

/** Weighted pick for rotation pools. */
export function pickWeightedAd<T extends { tier: string; format?: string | null }>(ads: T[]): T | null {
  if (!ads.length) return null;
  const weights = ads.map((ad) => {
    const t = resolvePlacementTier({ tier: ad.tier, format: ad.format });
    return rotationWeight(t);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < ads.length; i++) {
    r -= weights[i];
    if (r <= 0) return ads[i];
  }
  return ads[ads.length - 1];
}
