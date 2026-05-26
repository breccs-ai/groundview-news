'use client';

import Link from 'next/link';
import { useSubscription } from '@/lib/hooks/useSubscription';

/**
 * Single-line subscription nudge rendered just above the footer copyright bar.
 * Hidden for active subscribers; subtle (low-contrast) for free readers so it
 * stays unobtrusive.
 */
export default function FooterSubscribeNudge() {
  const { isSubscriber, loading } = useSubscription();

  if (loading) return null;
  if (isSubscriber) return null;

  return (
    <div className="border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 text-center text-xs sm:text-sm text-gray-300">
        Support independent journalism —{' '}
        <Link
          href="/subscribe"
          className="underline underline-offset-2 hover:text-white transition-colors"
          style={{ color: '#d4a017' }}
        >
          Subscribe from £4.99/month
        </Link>
      </div>
    </div>
  );
}
