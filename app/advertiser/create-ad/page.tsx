'use client';

import { useState, Suspense, useEffect, useLayoutEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import {
  getCheckoutPriceGbp,
  getMonthlyPriceGbp,
  getAnnualPriceLines,
  getBillingPlanRadioCaption,
  getSelectionSummarySentence,
  TIER_PRICING,
  type PlacementTier,
  type BillingCycle,
} from '@/lib/advertiser/pricing';
import { PLACEMENT_TIER_DESCRIPTIONS, PLACEMENT_TIER_NAMES } from '@/lib/advertiser/placements';

const PENDING_AD_DRAFT_KEY = 'pending_ad_draft';
const DRAFT_VERSION = 1;

type PendingAdDraft = {
  v: typeof DRAFT_VERSION;
  title: string;
  bodyText: string;
  destinationUrl: string;
  imageUrl: string;
  tier: PlacementTier;
  billing_cycle: BillingCycle;
  step: 1 | 2;
};

const PLACEMENT_TIERS: PlacementTier[] = ['basic', 'standard', 'premium'];

const gbpN = (n: number) => `£${n.toLocaleString('en-GB')}`;

function totalPriceLabel(tier: PlacementTier, billing: BillingCycle): string {
  const p = getCheckoutPriceGbp(tier, billing);
  if (billing === 'monthly') return `Total: ${gbpN(p)}/month GBP`;
  return `Total: ${gbpN(p)} billed annually GBP`;
}

function isPlacementTier(x: unknown): x is PlacementTier {
  return x === 'basic' || x === 'standard' || x === 'premium';
}

function isBillingCycle(x: unknown): x is BillingCycle {
  return x === 'monthly' || x === 'annual';
}

export default function CreateAdPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">Loading…</div>}>
      <CreateAdInner />
    </Suspense>
  );
}

function CreateAdInner() {
  const searchParams = useSearchParams();
  const cancelled = searchParams.get('cancelled');
  const sessionId = searchParams.get('session_id');
  const [step, setStep] = useState(1);
  const [adId, setAdId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [placementTier, setPlacementTier] = useState<PlacementTier | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [step2AuthChecked, setStep2AuthChecked] = useState(false);
  const [step2SignedIn, setStep2SignedIn] = useState(false);
  /** After restoring a draft at step 2, create the server ad once the user is signed in. */
  const [pendingServerAd, setPendingServerAd] = useState(false);
  const [initialDraftRaw] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(PENDING_AD_DRAFT_KEY);
  });

  useEffect(() => {
    if (sessionId) setStep(3);
  }, [sessionId]);

  useLayoutEffect(() => {
    if (sessionId) return;
    if (!initialDraftRaw) return;
    try {
      const d = JSON.parse(initialDraftRaw) as Partial<PendingAdDraft>;
      if (d.v !== DRAFT_VERSION || !isPlacementTier(d.tier) || !isBillingCycle(d.billing_cycle)) {
        localStorage.removeItem(PENDING_AD_DRAFT_KEY);
        return;
      }
      localStorage.removeItem(PENDING_AD_DRAFT_KEY);
      setTitle(typeof d.title === 'string' ? d.title : '');
      setBodyText(typeof d.bodyText === 'string' ? d.bodyText : '');
      setDestinationUrl(typeof d.destinationUrl === 'string' ? d.destinationUrl : '');
      setImageUrl(typeof d.imageUrl === 'string' ? d.imageUrl : '');
      setPlacementTier(d.tier);
      setBillingCycle(d.billing_cycle);
      setStep(d.step === 2 ? 2 : 1);
      setPendingServerAd(d.step === 2);
    } catch {
      localStorage.removeItem(PENDING_AD_DRAFT_KEY);
    }
  }, [sessionId, initialDraftRaw]);

  useEffect(() => {
    if (step !== 2) {
      setStep2AuthChecked(false);
      return;
    }
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setStep2SignedIn(!!data.session?.access_token);
      setStep2AuthChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [step]);

  useEffect(() => {
    if (step !== 2 || adId || !placementTier || !billingCycle || !pendingServerAd) return;
    if (!title.trim() || !destinationUrl.trim()) return;

    let cancelled = false;

    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || cancelled) return;

      setBusy(true);
      setErrorMsg('');
      try {
        const res = await fetch('/api/advertiser/ads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            body_text: bodyText.trim(),
            destination_url: destinationUrl.trim(),
            image_url: imageUrl,
            tier: placementTier,
            billing_cycle: billingCycle,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorMsg(typeof body.error === 'string' ? body.error : 'Could not save ad.');
          return;
        }
        const newId = body.ad_id as string;
        setAdId(newId);

        if (imageFile) {
          const fd = new FormData();
          fd.append('file', imageFile);
          fd.append('adId', newId);
          const up = await fetch('/api/advertiser/upload-ad-asset', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: fd,
          });
          const upBody = await up.json().catch(() => ({}));
          if (up.ok && upBody.url) {
            await fetch('/api/advertiser/ads', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ ad_id: newId, image_url: upBody.url }),
            });
            setImageUrl(upBody.url as string);
          }
        }

        setPendingServerAd(false);
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [step, adId, placementTier, billingCycle, title, bodyText, destinationUrl, imageUrl, pendingServerAd]);

  const price = placementTier && billingCycle ? getCheckoutPriceGbp(placementTier, billingCycle) : null;

  const persistDraftForStep2 = () => {
    if (!placementTier || !billingCycle) return;
    const draft: PendingAdDraft = {
      v: DRAFT_VERSION,
      title: title.trim(),
      bodyText: bodyText.trim(),
      destinationUrl: destinationUrl.trim(),
      imageUrl,
      tier: placementTier,
      billing_cycle: billingCycle,
      step: 2,
    };
    localStorage.setItem(PENDING_AD_DRAFT_KEY, JSON.stringify(draft));
    setPendingServerAd(true);
  };

  const submitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!placementTier || !billingCycle) {
      setErrorMsg('Please select a placement tier and billing cycle.');
      return;
    }
    if (!title.trim() || title.length > 80) {
      setErrorMsg('Title is required (max 80 characters).');
      return;
    }
    if (bodyText.length > 300) {
      setErrorMsg('Body text max 300 characters.');
      return;
    }
    if (!destinationUrl.trim()) {
      setErrorMsg('Destination URL is required.');
      return;
    }
    try {
      new URL(destinationUrl);
    } catch {
      setErrorMsg('Enter a valid URL including https://');
      return;
    }

    setBusy(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      persistDraftForStep2();
      setBusy(false);
      setStep(2);
      return;
    }

    const res = await fetch('/api/advertiser/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: title.trim(),
        body_text: bodyText.trim(),
        destination_url: destinationUrl.trim(),
        image_url: imageUrl,
        tier: placementTier,
        billing_cycle: billingCycle,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrorMsg(typeof body.error === 'string' ? body.error : 'Could not save ad.');
      setBusy(false);
      return;
    }
    const newId = body.ad_id as string;
    setAdId(newId);
    setPendingServerAd(false);

    if (imageFile) {
      const fd = new FormData();
      fd.append('file', imageFile);
      fd.append('adId', newId);
      const up = await fetch('/api/advertiser/upload-ad-asset', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const upBody = await up.json().catch(() => ({}));
      if (up.ok && upBody.url) {
        await fetch('/api/advertiser/ads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ad_id: newId, image_url: upBody.url }),
        });
        setImageUrl(upBody.url as string);
      }
    }

    setBusy(false);
    setStep(2);
  };

  const pay = async () => {
    if (!adId || !placementTier || !billingCycle) return;
    setBusy(true);
    setErrorMsg('');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setErrorMsg('Your session expired. Please sign in again from the review step.');
      setBusy(false);
      return;
    }
    const res = await fetch('/api/advertiser/create-ad-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ad_id: adId, tier: placementTier, billing_cycle: billingCycle }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) {
      setErrorMsg(typeof body.error === 'string' ? body.error : 'Checkout failed.');
      setBusy(false);
      return;
    }
    window.location.href = body.url as string;
  };

  const registerHref = '/advertiser/register?redirect=create-ad';

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-stone-50">
        <div className="max-w-xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            Create advertisement
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Step {step} of 3 ·{' '}
            <Link href="/legal/advertiser-terms" className="text-amber-800 underline">
              Advertiser terms
            </Link>
          </p>

          {cancelled && step < 3 && (
            <div className="mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md p-3">Payment was cancelled.</div>
          )}

          {step === 1 && (
            <form onSubmit={submitStep1} className="bg-white border rounded-lg p-6 space-y-4 shadow-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Title * (max 80)</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Body text (optional, max 300)</label>
                <textarea className="w-full border rounded-md px-3 py-2 text-sm" maxLength={300} rows={4} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Image (optional)</label>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Destination URL *</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://…" required />
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  The full web address where users will be taken when they click your ad. Example: https://yourwebsite.com
                </p>
              </div>

              <p className="text-sm text-gray-800 font-medium pt-1">Choose your placement tier and billing cycle.</p>

              <div className="space-y-3 pt-1">
                {PLACEMENT_TIERS.map((t) => {
                  const expanded = placementTier === t;
                  const monthly = getMonthlyPriceGbp(t);
                  const annualLines = getAnnualPriceLines(t);
                  return (
                    <div
                      key={t}
                      className={`rounded-xl border-2 overflow-hidden transition-shadow ${
                        expanded ? 'border-amber-600 shadow-md' : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPlacementTier(t);
                          setBillingCycle(null);
                        }}
                        className="w-full text-left p-4 bg-white"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-serif text-base font-bold text-gray-900">{PLACEMENT_TIER_NAMES[t]}</span>
                          <span className="text-sm font-bold text-amber-800">From {gbpN(monthly)}/month</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{PLACEMENT_TIER_DESCRIPTIONS[t]}</p>
                      </button>
                      {expanded && (
                        <div className="border-t border-amber-100 bg-stone-50/90 px-4 py-4 space-y-3">
                          <button
                            type="button"
                            onClick={() => setBillingCycle('monthly')}
                            className={`w-full text-left rounded-lg border px-3 py-3 text-sm ${
                              billingCycle === 'monthly'
                                ? 'border-amber-600 bg-amber-50/90 ring-1 ring-amber-200'
                                : 'border-stone-200 bg-white'
                            }`}
                          >
                            <div className="font-semibold text-gray-900">
                              Monthly — <span className="text-amber-900">{gbpN(monthly)}/month</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">Auto-renews monthly. Cancel anytime from your dashboard.</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setBillingCycle('annual')}
                            className={`w-full text-left rounded-lg border px-3 py-3 text-sm ${
                              billingCycle === 'annual'
                                ? 'border-amber-600 bg-amber-50/90 ring-1 ring-amber-200'
                                : 'border-stone-200 bg-white'
                            }`}
                          >
                            <div className="font-semibold text-gray-900">
                              Annual — <span className="text-amber-900">{annualLines.annualTotal}</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              {annualLines.effectiveMonthly} (~{annualLines.savingsPercent}% vs monthly). Billed annually upfront.
                            </p>
                          </button>
                          {billingCycle && (
                            <p className="text-base font-bold text-amber-900">{totalPriceLabel(t, billingCycle)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {errorMsg && <p className="text-sm text-red-700">{errorMsg}</p>}
              {placementTier && billingCycle && (
                <button type="submit" disabled={busy} className="w-full py-3 rounded-md bg-[#0f1f3d] text-white font-semibold text-sm disabled:opacity-60">
                  {busy ? 'Saving…' : 'Review and pay'}
                </button>
              )}
            </form>
          )}

          {step === 2 && !step2AuthChecked && (
            <div className="bg-white border rounded-lg p-6 shadow-sm text-sm text-gray-600">Checking your session…</div>
          )}

          {step === 2 && step2AuthChecked && !step2SignedIn && (
            <div className="bg-white border rounded-lg p-6 space-y-4 shadow-sm">
              <h2 className="font-bold text-gray-900">Review and pay</h2>
              <p className="text-sm text-gray-800 leading-relaxed">
                To complete your order, please sign in or create a free advertiser account. Your ad details have been saved
                and you can continue from here once you are signed in.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href={registerHref}
                  className="inline-flex justify-center items-center py-3 px-4 rounded-md bg-[#0f1f3d] text-white font-semibold text-sm"
                >
                  Sign In
                </Link>
                <Link
                  href={registerHref}
                  className="inline-flex justify-center items-center py-3 px-4 rounded-md border-2 border-[#0f1f3d] text-[#0f1f3d] font-semibold text-sm"
                >
                  Create Account
                </Link>
              </div>
              <button type="button" className="w-full text-sm text-gray-600 underline text-left" onClick={() => setStep(1)}>
                Back to edit details
              </button>
            </div>
          )}

          {step === 2 && step2AuthChecked && step2SignedIn && (
            <div className="bg-white border rounded-lg p-6 space-y-4 shadow-sm">
              <h2 className="font-bold text-gray-900">Review and pay</h2>
              {placementTier && billingCycle && price !== null ? (
                <>
                  <div className="rounded-lg border-2 border-amber-200 bg-amber-50 px-4 py-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Total due (GBP)</p>
                    <p className="text-3xl font-bold text-amber-950 mt-1">£{price.toFixed(2)}</p>
                    <p className="text-sm text-gray-800 mt-3 leading-relaxed">{getSelectionSummarySentence(placementTier, billingCycle)}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-amber-900">Your saved draft is missing tier or billing cycle. Go back and select both.</p>
              )}
              <ul className="text-sm text-gray-700 space-y-1">
                <li>
                  <strong>Title:</strong> {title}
                </li>
                <li>
                  <strong>Destination:</strong> {destinationUrl}
                </li>
                {placementTier && billingCycle && (
                  <li>
                    <strong>Tier / billing:</strong> {PLACEMENT_TIER_NAMES[placementTier]} / {billingCycle === 'monthly' ? 'Monthly' : 'Annual'} (
                    {getBillingPlanRadioCaption(placementTier, billingCycle)})
                  </li>
                )}
                {price !== null && (
                  <li>
                    <strong>Price:</strong> £{price.toFixed(2)} GBP
                  </li>
                )}
              </ul>
              <p className="text-xs text-gray-600">You will be redirected to Stripe Checkout. Card payments are processed in GBP.</p>
              {errorMsg && <p className="text-sm text-red-700">{errorMsg}</p>}
              {pendingServerAd && !adId && (
                <p className="text-sm text-gray-600">{busy ? 'Saving your ad…' : 'Preparing your saved ad…'}</p>
              )}
              <button
                type="button"
                disabled={busy || !adId || !placementTier || !billingCycle}
                onClick={() => void pay()}
                className="w-full py-3 rounded-md bg-amber-700 text-white font-semibold text-sm disabled:opacity-60"
              >
                {busy ? 'Redirecting…' : 'Pay with Stripe'}
              </button>
              <button type="button" className="w-full text-sm text-gray-600 underline" onClick={() => setStep(1)}>
                Back
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white border rounded-lg p-6 space-y-4 shadow-sm text-sm text-gray-800">
              <p className="font-semibold text-green-800">Your payment was successful.</p>
              <p>Your ad is now being reviewed and will go live automatically once approved.</p>
              {sessionId && <p className="text-xs text-gray-500">Reference: {sessionId}</p>}
              <Link href="/advertiser/dashboard" className="inline-block mt-2 text-amber-900 font-semibold underline">
                Go to dashboard
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
