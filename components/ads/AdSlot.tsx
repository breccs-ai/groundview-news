'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AdBanner from '@/components/ads/AdBanner';
import type { ActiveAd } from '@/lib/advertiser/active-ads';
import { pickWeightedAd } from '@/lib/advertiser/active-ads';
import type { AdZone } from '@/lib/advertiser/placements';

const ROTATE_MS = 30_000;

type Props = {
  zone: AdZone;
  variant?: 'featured' | 'sidebar' | 'inline' | 'footer';
  className?: string;
};

async function track(adId: string, event: 'view' | 'click') {
  try {
    await fetch('/api/ads/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad_id: adId, event }),
    });
  } catch {
    /* non-blocking */
  }
}

export default function AdSlot({ zone, variant = 'sidebar', className = '' }: Props) {
  const [pool, setPool] = useState<ActiveAd[]>([]);
  const [current, setCurrent] = useState<ActiveAd | null>(null);
  const impressed = useRef<Set<string>>(new Set());

  const rotate = useCallback((ads: ActiveAd[]) => {
    if (!ads.length) {
      setCurrent(null);
      return;
    }
    setCurrent(pickWeightedAd(ads));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/ads/display?zone=${encodeURIComponent(zone)}`)
      .then((r) => r.json())
      .then((body: { ads?: ActiveAd[]; initial?: ActiveAd | null }) => {
        if (cancelled) return;
        const ads = body.ads || [];
        setPool(ads);
        setCurrent(body.initial || pickWeightedAd(ads));
      })
      .catch(() => {
        if (!cancelled) setCurrent(null);
      });
    return () => {
      cancelled = true;
    };
  }, [zone]);

  useEffect(() => {
    if (pool.length <= 1) return;
    const id = window.setInterval(() => rotate(pool), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [pool, rotate]);

  useEffect(() => {
    if (!current?.id) return;
    if (impressed.current.has(current.id)) return;
    impressed.current.add(current.id);
    void track(current.id, 'view');
  }, [current?.id]);

  if (!current) return null;

  return (
    <div className={className}>
      <AdBanner
        ad={current}
        variant={variant}
        onClick={(id) => {
          void track(id, 'click');
        }}
      />
    </div>
  );
}
