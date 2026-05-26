'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSubscription } from '@/lib/hooks/useSubscription';

const NAVY = '#0f1f3d';
const GOLD = '#d4a017';

type Props = {
  /** ISO timestamp at which the article becomes universally visible. */
  publishAt: string | null | undefined;
};

/**
 * Soft early-access banner shown at the top of the article body when the
 * article is inside its 24-hour subscriber window. Article content is never
 * hidden — this is purely a nudge.
 *
 * Conditions for visibility:
 *   - publishAt is set, AND
 *   - publishAt is in the future, AND
 *   - the reader is NOT an active subscriber.
 */
export default function EarlyAccessBanner({ publishAt }: Props) {
  const { isSubscriber, loading } = useSubscription();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  if (!publishAt) return null;
  if (loading) return null;
  if (isSubscriber) return null;
  if (now === null) return null; // pre-hydration

  const target = new Date(publishAt).getTime();
  if (!Number.isFinite(target)) return null;
  if (target <= now) return null;

  return (
    <aside
      role="note"
      className="mb-8 rounded-sm border px-4 sm:px-5 py-4"
      style={{ borderColor: GOLD, backgroundColor: 'rgba(212, 160, 23, 0.08)' }}
    >
      <p className="text-sm leading-relaxed" style={{ color: NAVY }}>
        <span className="font-semibold">Subscribers are reading this now.</span>{' '}
        <Link
          href="/subscribe"
          className="underline underline-offset-2 hover:opacity-80"
          style={{ color: NAVY }}
        >
          Subscribe to get early access to every article.
        </Link>
      </p>
    </aside>
  );
}
