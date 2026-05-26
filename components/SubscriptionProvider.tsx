'use client';

import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * SubscriptionProvider
 *
 * Mounted once in the root layout. On mount, asks the server "is the current
 * reader an active paying subscriber?" using the Supabase JS auth session
 * (passed through as a Bearer token to `/api/me/subscription`).
 *
 * Components such as AdSlot, SubscriptionPromptBanner, EarlyAccessBanner, and
 * FooterSubscribeNudge read this context to skip rendering for subscribers.
 *
 * Until the lookup completes, `loading` is true and `isSubscriber` is false
 * (fail-closed for the gating direction that matters here — we'd rather
 * briefly show an ad to a subscriber on first paint than briefly hide every
 * ad from every free reader).
 */

export type SubscriptionContextValue = {
  isSubscriber: boolean;
  loading: boolean;
  status: string | null;
  plan: 'monthly' | 'annual' | null;
  expiresAt: string | null;
};

const initialValue: SubscriptionContextValue = {
  isSubscriber: false,
  loading: true,
  status: null,
  plan: null,
  expiresAt: null,
};

export const SubscriptionContext = createContext<SubscriptionContextValue>(initialValue);

type ApiResponse = {
  isSubscriber?: boolean;
  status?: string | null;
  plan?: 'monthly' | 'annual' | null;
  expires_at?: string | null;
};

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<SubscriptionContextValue>(initialValue);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        if (!cancelled) {
          setValue({
            isSubscriber: false,
            loading: false,
            status: null,
            plan: null,
            expiresAt: null,
          });
        }
        return;
      }

      try {
        const res = await fetch('/api/me/subscription', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const body = (await res.json().catch(() => ({}))) as ApiResponse;
        if (cancelled) return;
        setValue({
          isSubscriber: Boolean(body.isSubscriber),
          loading: false,
          status: body.status ?? null,
          plan: body.plan ?? null,
          expiresAt: body.expires_at ?? null,
        });
      } catch {
        if (cancelled) return;
        setValue({
          isSubscriber: false,
          loading: false,
          status: null,
          plan: null,
          expiresAt: null,
        });
      }
    }

    void fetchStatus();

    // Refresh status if the user signs in or out mid-session, so the AdSlot
    // gate updates without a hard refresh.
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void fetchStatus();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const memo = useMemo(() => value, [value]);

  return <SubscriptionContext.Provider value={memo}>{children}</SubscriptionContext.Provider>;
}
