import { NextRequest, NextResponse } from 'next/server';
import { fetchActiveAdsForZone, pickWeightedAd } from '@/lib/advertiser/active-ads';
import type { AdZone } from '@/lib/advertiser/placements';

export const runtime = 'nodejs';

const ZONES: AdZone[] = [
  'homepage_featured',
  'homepage_sidebar',
  'article_in_content',
  'article_sidebar',
  'footer',
];

export async function GET(req: NextRequest) {
  const zone = req.nextUrl.searchParams.get('zone') as AdZone | null;
  if (!zone || !ZONES.includes(zone)) {
    return NextResponse.json({ error: 'Invalid zone' }, { status: 400 });
  }

  const ads = await fetchActiveAdsForZone(zone);
  const initial = pickWeightedAd(ads);

  return NextResponse.json(
    { zone, ads, initial },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    }
  );
}
