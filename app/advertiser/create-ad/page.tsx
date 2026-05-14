'use client';

import { useState, Suspense, useEffect, useLayoutEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import {
  AD_PRICING,
  FORMAT_DISPLAY_LABELS,
  getAdPriceGbp,
  getBillingPlanFormalName,
  getBillingPlanRadioCaption,
  getSelectionSummarySentence,
  type AdFormat,
  type AdTier,
} from '@/lib/advertiser/pricing';

const PENDING_AD_DRAFT_KEY = 'pending_ad_draft';
const DRAFT_VERSION = 1;

type PendingAdDraft = {
  v: typeof DRAFT_VERSION;
  title: string;
  bodyText: string;
  destinationUrl: string;
  imageUrl: string;
  format: AdFormat;
  tier: AdTier;
  step: 1 | 2;
};

const FORMATS: AdFormat[] = ['leaderboard_banner', 'sidebar_banner', 'sponsored_article'];

const gbpN = (n: number) => `£${n.toLocaleString('en-GB')}`;
const px = (f: AdFormat, t: AdTier) => gbpN(getAdPriceGbp(f, t));

/** Card row: starting price = one-off price for that format. */
const AD_TYPE_CARD: Record<AdFormat, { fromPrice: number; line: string }> = {
  leaderboard_banner: {
    fromPrice: getAdPriceGbp('leaderboard_banner', 'one_off'),
    line: 'Full-width banner at the top of every page — maximum visibility',
  },
  sidebar_banner: {
    fromPrice: getAdPriceGbp('sidebar_banner', 'one_off'),
    line: 'Sidebar placement on all article pages — consistent exposure',
  },
  sponsored_article: {
    fromPrice: getAdPriceGbp('sponsored_article', 'one_off'),
    line: 'Your content published as a clearly labelled sponsored article',
  },
};

type PlanRow = {
  tier: AdTier;
  name: string;
  priceLead: string;
  body: string;
  inclusionOneLine: string;
};

const EXPANDED_PLANS: Record<AdFormat, { intro: string; plans: PlanRow[] }> = {
  leaderboard_banner: {
    intro:
      'Your creative runs as a full-width banner at the top of every page on Ground View News — the highest-attention placement we offer.',
    plans: [
      {
        tier: 'one_off',
        name: 'One-off',
        priceLead: px('leaderboard_banner', 'one_off'),
        body: 'Runs for 7 days from approval. Single payment, no renewal.',
        inclusionOneLine: 'Runs for 7 days from approval. Single payment, no renewal.',
      },
      {
        tier: 'monthly',
        name: 'Monthly',
        priceLead: `${px('leaderboard_banner', 'monthly')}/month`,
        body: 'Runs continuously. Billed monthly. Cancel anytime.',
        inclusionOneLine: 'Runs continuously, billed monthly, cancel anytime.',
      },
      {
        tier: 'annual',
        name: 'Annual',
        priceLead: `${px('leaderboard_banner', 'annual')}/year`,
        body: 'Best value. Runs all year. Includes priority placement, monthly reports, and first right of renewal. Saves 33% vs monthly.',
        inclusionOneLine:
          'Year-round placement with priority treatment, monthly reports, first right of renewal, and 33% savings vs paying monthly.',
      },
    ],
  },
  sidebar_banner: {
    intro: 'Your ad appears in the article sidebar on every story — steady visibility next to our independent reporting.',
    plans: [
      {
        tier: 'one_off',
        name: 'One-off',
        priceLead: px('sidebar_banner', 'one_off'),
        body: 'Runs for 7 days from approval. Single payment, no renewal.',
        inclusionOneLine: 'Runs for 7 days from approval. Single payment, no renewal.',
      },
      {
        tier: 'monthly',
        name: 'Monthly',
        priceLead: `${px('sidebar_banner', 'monthly')}/month`,
        body: 'Runs continuously. Billed monthly. Cancel anytime.',
        inclusionOneLine: 'Runs continuously, billed monthly, cancel anytime.',
      },
      {
        tier: 'annual',
        name: 'Annual',
        priceLead: `${px('sidebar_banner', 'annual')}/year`,
        body: 'Best value. Runs all year. Includes priority placement, monthly reports, and first right of renewal. Saves 33% vs monthly.',
        inclusionOneLine:
          'Year-round placement with priority treatment, monthly reports, first right of renewal, and 33% savings vs paying monthly.',
      },
    ],
  },
  sponsored_article: {
    intro: 'Sponsored articles are published like regular stories but always clearly labelled as sponsored content.',
    plans: [
      {
        tier: 'one_off',
        name: 'One-off',
        priceLead: px('sponsored_article', 'one_off'),
        body: 'Single article published and live for 30 days.',
        inclusionOneLine: 'Single sponsored article, live for 30 days.',
      },
      {
        tier: 'monthly',
        name: 'Monthly',
        priceLead: `${px('sponsored_article', 'monthly')}/month`,
        body: 'Two sponsored articles per month. Billed monthly. Cancel anytime.',
        inclusionOneLine: 'Two sponsored articles per month, billed monthly — cancel anytime.',
      },
      {
        tier: 'annual',
        name: 'Annual',
        priceLead: `${px('sponsored_article', 'annual')}/year`,
        body: 'Up to three articles per month. Best value. Includes priority placement and monthly performance reports. Saves 33% vs monthly.',
        inclusionOneLine:
          'Up to three sponsored articles per month with priority placement, monthly performance reports, and 33% savings vs monthly.',
      },
    ],
  },
};

function totalPriceLabel(format: AdFormat, tier: AdTier): string {
  const p = getAdPriceGbp(format, tier);
  if (tier === 'one_off') return `Total: ${gbpN(p)} GBP`;
  if (tier === 'monthly') return `Total: ${gbpN(p)}/month GBP`;
  return `Total: ${gbpN(p)}/year GBP`;
}

function planRowFor(format: AdFormat, tier: AdTier): PlanRow | undefined {
  return EXPANDED_PLANS[format].plans.find((p) => p.tier === tier);
}

function isAdFormat(x: unknown): x is AdFormat {
  return x === 'leaderboard_banner' || x === 'sidebar_banner' || x === 'sponsored_article';
}

function isAdTier(x: unknown): x is AdTier {
  return x === 'one_off' || x === 'monthly' || x === 'annual';
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
  const [format, setFormat] = useState<AdFormat | null>(null);
  const [tier, setTier] = useState<AdTier | null>(null);
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
      if (d.v !== DRAFT_VERSION || !isAdFormat(d.format) || !isAdTier(d.tier)) {
        localStorage.removeItem(PENDING_AD_DRAFT_KEY);
        return;
      }
      localStorage.removeItem(PENDING_AD_DRAFT_KEY);
      setTitle(typeof d.title === 'string' ? d.title : '');
      setBodyText(typeof d.bodyText === 'string' ? d.bodyText : '');
      setDestinationUrl(typeof d.destinationUrl === 'string' ? d.destinationUrl : '');
      setImageUrl(typeof d.imageUrl === 'string' ? d.imageUrl : '');
      setFormat(d.format);
      setTier(d.tier);
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
    if (step !== 2 || adId || !format || !tier || !pendingServerAd) return;
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
            format,
            tier,
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
  }, [step, adId, format, tier, title, bodyText, destinationUrl, imageUrl, pendingServerAd]);

  const price = format && tier ? getAdPriceGbp(format, tier) : null;
  const label = format && tier ? AD_PRICING[format][tier].label : null;

  const persistDraftForStep2 = () => {
    if (!format || !tier) return;
    const draft: PendingAdDraft = {
      v: DRAFT_VERSION,
      title: title.trim(),
      bodyText: bodyText.trim(),
      destinationUrl: destinationUrl.trim(),
      imageUrl,
      format,
      tier,
      step: 2,
    };
    localStorage.setItem(PENDING_AD_DRAFT_KEY, JSON.stringify(draft));
    setPendingServerAd(true);
  };

  const submitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!format || !tier) {
      setErrorMsg('Please select an ad type and a billing plan.');
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
        format,
        tier,
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
    if (!adId || !format || !tier) return;
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
      body: JSON.stringify({ ad_id: adId, format, tier }),
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

              <p className="text-sm text-gray-800 font-medium pt-1">Select your ad type and billing plan below.</p>

              <div className="space-y-3 pt-1">
                {FORMATS.map((f) => {
                  const meta = AD_TYPE_CARD[f];
                  const expanded = format === f;
                  return (
                    <div
                      key={f}
                      className={`rounded-xl border-2 overflow-hidden transition-shadow ${
                        expanded ? 'border-amber-600 shadow-md' : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setFormat(f);
                          setTier(null);
                        }}
                        className="w-full text-left p-4 bg-white"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-serif text-base font-bold text-gray-900">{FORMAT_DISPLAY_LABELS[f]}</span>
                          <span className="text-sm font-bold text-amber-800">From {gbpN(meta.fromPrice)}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{meta.line}</p>
                      </button>
                      {expanded && (
                        <div className="border-t border-amber-100 bg-stone-50/90 px-4 py-4 space-y-4">
                          <p className="text-xs text-gray-700 leading-relaxed">{EXPANDED_PLANS[f].intro}</p>
                          <div className="space-y-2">
                            {EXPANDED_PLANS[f].plans.map((row) => {
                              const chosen = tier === row.tier;
                              return (
                                <button
                                  key={row.tier}
                                  type="button"
                                  onClick={() => setTier(row.tier)}
                                  className={`w-full text-left rounded-lg border px-3 py-3 text-sm transition-colors ${
                                    chosen
                                      ? 'border-amber-600 bg-amber-50/90 ring-1 ring-amber-200'
                                      : 'border-stone-200 bg-white hover:border-stone-300'
                                  }`}
                                >
                                  <div className="font-semibold text-gray-900">
                                    {row.name} — <span className="text-amber-900">{row.priceLead}</span>
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{row.body}</p>
                                </button>
                              );
                            })}
                          </div>
                          {tier && planRowFor(f, tier) && (
                            <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm space-y-2">
                              <p className="font-semibold text-gray-900">
                                {FORMAT_DISPLAY_LABELS[f]} — {getBillingPlanFormalName(tier)}
                              </p>
                              <p className="text-sm text-gray-800">
                                <span className="font-semibold">{getBillingPlanFormalName(tier)}</span> —{' '}
                                {planRowFor(f, tier)!.priceLead}
                              </p>
                              <p className="text-gray-700 text-sm leading-relaxed">{planRowFor(f, tier)!.inclusionOneLine}</p>
                              <p className="text-base font-bold text-amber-900 pt-1">{totalPriceLabel(f, tier)}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {errorMsg && <p className="text-sm text-red-700">{errorMsg}</p>}
              {format && tier && (
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
              {format && tier && price !== null ? (
                <>
                  <div className="rounded-lg border-2 border-amber-200 bg-amber-50 px-4 py-5 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Total due (GBP)</p>
                    <p className="text-3xl font-bold text-amber-950 mt-1">£{price.toFixed(2)}</p>
                    <p className="text-sm text-gray-800 mt-3 leading-relaxed">{getSelectionSummarySentence(format, tier)}</p>
                  </div>
                  {label && <p className="text-xs text-gray-500 text-center">{label}</p>}
                </>
              ) : (
                <p className="text-sm text-amber-900">Your saved draft is missing ad type or billing plan. Go back and select both.</p>
              )}
              <ul className="text-sm text-gray-700 space-y-1">
                <li>
                  <strong>Title:</strong> {title}
                </li>
                <li>
                  <strong>Destination:</strong> {destinationUrl}
                </li>
                {format && tier && (
                  <li>
                    <strong>Ad type / billing:</strong> {FORMAT_DISPLAY_LABELS[format]} / {getBillingPlanFormalName(tier)} (
                    {getBillingPlanRadioCaption(format, tier)})
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
                disabled={busy || !adId || !format || !tier}
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
