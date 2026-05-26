import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Reader subscription helpers.
 *
 * Status values used across the app:
 *   - 'free'      — default for new readers (no Stripe relationship)
 *   - 'active'    — paying subscriber, within their paid window
 *   - 'past_due'  — Stripe reported a failed renewal payment
 *   - 'cancelled' — subscription explicitly cancelled in Stripe
 *
 * Legacy values from the journalist approval flow ('pending_approval', etc.)
 * also live on profiles.subscription_status — those are always treated as
 * NON-subscriber for the purpose of ad gating.
 */

export type ReaderSubscriptionStatus = 'free' | 'active' | 'past_due' | 'cancelled' | string;
export type ReaderSubscriptionPlan = 'monthly' | 'annual' | null;

export type ReaderSubscriptionRow = {
  subscription_status: ReaderSubscriptionStatus | null;
  subscription_plan: ReaderSubscriptionPlan;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
};

/**
 * The single predicate every other piece of code should rely on. A reader is
 * considered an active subscriber only when:
 *   1. status === 'active', AND
 *   2. expires_at is in the future (or unset, for forward-tolerance).
 *
 * Annual one-off payments still receive a finite expires_at at webhook time,
 * so the same check works for both billing cycles.
 */
export function isActiveSubscriber(row: ReaderSubscriptionRow | null | undefined): boolean {
  if (!row) return false;
  if (row.subscription_status !== 'active') return false;
  if (!row.subscription_expires_at) return true;
  const exp = new Date(row.subscription_expires_at).getTime();
  if (!Number.isFinite(exp)) return true;
  return exp > Date.now();
}

/**
 * Server-side lookup. Returns null if no profile exists or env isn't ready.
 * Uses the service-role Supabase client passed in by the caller so this
 * helper itself stays env-agnostic and testable.
 */
export async function getReaderSubscriptionByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReaderSubscriptionRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_plan, subscription_started_at, subscription_expires_at')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ReaderSubscriptionRow;
}

/**
 * Used by the webhook to look up an existing profile by buyer email, so that
 * we can attach the subscription to an existing account when the buyer signs
 * up later. Returns null if no profile exists; callers should provision one.
 */
export async function getProfileByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<{ id: string } | null> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, email')
    .ilike('email', trimmed)
    .maybeSingle();
  if (!data) return null;
  return { id: (data as { id: string }).id };
}

/** Compute the expiry date for a freshly-purchased subscription. */
export function computeExpiry(plan: 'monthly' | 'annual', from: Date = new Date()): Date {
  const out = new Date(from.getTime());
  if (plan === 'monthly') {
    out.setUTCMonth(out.getUTCMonth() + 1);
  } else {
    out.setUTCFullYear(out.getUTCFullYear() + 1);
  }
  return out;
}
