'use client';

import { useState, type CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';

type Props = {
  plan: 'monthly' | 'annual';
  label: string;
  /** Tailwind classes describing the visual variant (primary gold vs ghost). */
  className?: string;
  /** Inline style overrides — used to pass the navy primary colour on the annual card. */
  style?: CSSProperties;
};

/**
 * Single-purpose client button for the /subscribe pricing cards.
 *
 * Flow:
 *   1. Click → POST /api/subscribe/create-checkout { plan }.
 *   2. If the visitor is signed in, attach their Bearer token so the webhook
 *      can link the subscription directly to their existing profile.
 *   3. Redirect window.location to the returned Stripe Checkout URL.
 */
export default function SubscribeCheckoutButton({ plan, label, className, style }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/subscribe/create-checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        throw new Error(body.error || 'Could not start checkout');
      }
      window.location.assign(body.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout');
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        style={style}
        className={
          className ||
          'w-full inline-flex items-center justify-center px-5 py-3 text-sm font-semibold rounded-sm transition-colors disabled:opacity-60'
        }
      >
        {loading ? 'Redirecting…' : label}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
