'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSubscription } from '@/lib/hooks/useSubscription';

const NAVY = '#0f1f3d';
const GOLD = '#d4a017';
const DISMISS_KEY = 'gvn_sub_banner_dismissed';

/**
 * Inline subscription prompt rendered between the article body and the
 * related-articles section. Never blocks reading.
 *
 * Hidden when:
 *   - the visitor is an active subscriber, or
 *   - the visitor dismissed the banner earlier in the session
 *     (sessionStorage; restored on page reload within the same tab session).
 */
export default function SubscriptionPromptBanner() {
  const { isSubscriber, loading } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
    } catch {
      /* sessionStorage unavailable (e.g. privacy mode) — banner stays visible */
    }
  }, []);

  if (!hydrated) return null; // avoid hydration flicker
  if (loading) return null;
  if (isSubscriber) return null;
  if (dismissed) return null;

  function onDismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* no-op */
    }
  }

  return (
    <section
      aria-label="Support Ground View News"
      className="my-12 rounded-sm overflow-hidden"
      style={{ backgroundColor: NAVY, color: '#fff' }}
    >
      <div className="px-5 sm:px-8 py-8 sm:py-10 max-w-4xl mx-auto">
        <h2
          className="text-2xl sm:text-3xl font-bold leading-tight mb-2"
          style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
        >
          Independent journalism, freely available
        </h2>
        <p className="text-sm sm:text-base text-gray-200 leading-relaxed mb-6 max-w-2xl">
          Ground View News is reader-supported. Subscribe to remove ads and support our writers.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <Link
            href="/subscribe"
            className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold rounded-sm transition-colors hover:opacity-90"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            Subscribe — £4.99/month
          </Link>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs sm:text-sm text-gray-300 hover:text-white underline-offset-2 hover:underline transition-colors text-center sm:text-left"
          >
            Maybe later
          </button>
        </div>
      </div>
    </section>
  );
}
