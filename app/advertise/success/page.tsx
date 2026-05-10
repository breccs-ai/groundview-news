'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { CircleCheck } from 'lucide-react';

const NAVY = '#0f1f3d';
const GOLD = '#D4AF37';

type AdRow = {
  title: string;
  company_name: string;
  package_days: number;
  package_price_pence: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function fmtPrice(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function SuccessInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [ad, setAd] = useState<AdRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setError('Missing payment confirmation. If you completed a payment, check your advertiser dashboard.');
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error: qErr } = await supabase
        .from('advertisements')
        .select(
          'title, company_name, package_days, package_price_pence, status, starts_at, ends_at'
        )
        .eq('stripe_session_id', sessionId)
        .maybeSingle();

      if (qErr) {
        setError(`Could not load ad details: ${qErr.message}`);
      } else if (!data) {
        setError(
          'We could not match this payment to an ad yet. If you just paid, open your dashboard — it may take a few seconds to activate.'
        );
      } else {
        setAd(data as AdRow);
      }
      setLoading(false);
    })();
  }, [sessionId]);

  return (
    <>
      <Navbar />
      <main className="bg-white min-h-screen">
        <div style={{ backgroundColor: NAVY }} className="py-12">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-600/20 mb-4">
              <CircleCheck className="text-green-400" size={40} strokeWidth={2} />
            </div>
            <h1
              className="text-2xl md:text-3xl font-bold text-white mb-2"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Payment successful!
            </h1>
            <p className="text-lg text-gray-300">
              Your ad is now live.
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="border border-amber-200 bg-amber-50 rounded-sm px-5 py-4 text-sm text-amber-950">
              {error}
              <div className="mt-4">
                <Link
                  href="/advertise/dashboard"
                  className="inline-flex font-semibold text-[#0f1f3d] underline"
                >
                  Go to advertiser dashboard
                </Link>
              </div>
            </div>
          ) : ad ? (
            <div className="space-y-6">
              <div className="border border-gray-200 rounded-sm p-6 bg-gray-50/80">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
                  Order summary
                </h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Company</dt>
                    <dd className="font-medium text-gray-900 text-right">{ad.company_name}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Ad title</dt>
                    <dd className="font-medium text-gray-900 text-right">{ad.title}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Package</dt>
                    <dd className="font-medium text-gray-900 text-right">
                      {ad.package_days} days · {fmtPrice(ad.package_price_pence)}
                    </dd>
                  </div>
                  {ad.starts_at && ad.ends_at && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-500">Schedule</dt>
                      <dd className="font-medium text-gray-900 text-right">
                        {fmtDate(ad.starts_at)} – {fmtDate(ad.ends_at)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Status</dt>
                    <dd className="font-medium text-gray-900 text-right capitalize">
                      {ad.status.replace(/_/g, ' ')}
                    </dd>
                  </div>
                </dl>
              </div>
              <p className="text-sm text-gray-600">
                View impressions and performance on your dashboard. Activation usually completes within
                seconds after payment.
              </p>
              <Link
                href="/advertise/dashboard"
                className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-3.5 text-sm font-semibold rounded-sm text-[#1a1a1a] shadow-sm transition-opacity hover:opacity-95"
                style={{ backgroundColor: GOLD }}
              >
                View ad performance
              </Link>
            </div>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function AdvertiseSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
