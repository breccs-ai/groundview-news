'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';

type Profile = {
  kyc_status: string;
  company_name: string;
  contact_name: string;
  email: string;
};

type AdRow = {
  id: string;
  title: string;
  status: string;
  format: string;
  tier: string;
  expires_at: string | null;
  view_count: number | null;
  click_count: number | null;
};

export default function AdvertiserDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ads, setAds] = useState<AdRow[]>([]);
  const [invoices, setInvoices] = useState<
    { id: string; status: string | null; amount_paid: number; currency: string; created: number; hosted_invoice_url: string | null }[]
  >([]);
  const [passwordResetNotice, setPasswordResetNotice] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setProfile(null);
      setAds([]);
      setInvoices([]);
      setLoading(false);
      setAuthReady(true);
      return;
    }
    const res = await fetch('/api/advertiser/dashboard-data', { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setProfile(null);
      setAds([]);
      setInvoices([]);
    } else {
      setProfile((body.profile || null) as Profile | null);
      setAds((body.ads || []) as AdRow[]);
      setInvoices(body.invoices || []);
    }
    setLoading(false);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('gv_advertiser_pw_reset_ok') === '1') {
      sessionStorage.removeItem('gv_advertiser_pw_reset_ok');
      setPasswordResetNotice(true);
    }
  }, []);

  const openBillingPortal = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    const res = await fetch('/api/advertiser/billing-portal', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => ({}));
    if (body.url) window.location.href = body.url as string;
  };

  const cancelSub = async (adId: string) => {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return;
    await fetch('/api/advertiser/subscription-cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ advertisement_id: adId }),
    });
    await load();
  };

  const kyc = profile?.kyc_status || 'pending';
  const kycVerified = kyc === 'verified';

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-stone-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {passwordResetNotice && (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              Your password has been updated. You are now signed in.
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Advertiser dashboard
            </h1>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => void openBillingPortal()} className="px-4 py-2 text-sm border rounded-md bg-white">
                Billing portal
              </button>
              <Link
                href="/advertiser/create-ad"
                className={`px-4 py-2 text-sm rounded-md font-semibold text-center ${
                  kycVerified ? 'bg-[#0f1f3d] text-white' : 'bg-gray-200 text-gray-500 pointer-events-none'
                }`}
                aria-disabled={!kycVerified}
              >
                Create new advertisement
              </Link>
            </div>
          </div>

          {!authReady || loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : !profile ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-sm">
              <p className="mb-2">No advertiser profile found.</p>
              <Link href="/advertiser/register" className="text-amber-900 font-semibold underline">
                Complete registration
              </Link>{' '}
              or{' '}
              <Link href="/advertiser/login" className="underline">
                sign in
              </Link>
              .
            </div>
          ) : (
            <>
              <div
                className={`mb-8 rounded-lg border p-4 text-sm ${
                  kycVerified ? 'bg-green-50 border-green-200 text-green-900' : kyc === 'failed' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {kycVerified && <p>Identity verification: verified. You can purchase ads.</p>}
                {kyc === 'pending' && <p>Identity verification: pending. Complete verification to enable ad checkout.</p>}
                {kyc === 'failed' && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <p>Identity verification failed. Please retry.</p>
                    <Link href="/advertiser/register?step=2" className="inline-block px-3 py-1.5 bg-red-800 text-white rounded-md text-xs font-semibold w-fit">
                      Retry verification
                    </Link>
                  </div>
                )}
              </div>

              <section className="mb-10">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Active campaigns</h2>
                <div className="bg-white border rounded-lg overflow-hidden">
                  {ads.length === 0 ? (
                    <p className="p-6 text-sm text-gray-500">No advertisements yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left px-4 py-2">Title</th>
                            <th className="text-left px-4 py-2">Status</th>
                            <th className="text-left px-4 py-2 hidden sm:table-cell">Format</th>
                            <th className="text-left px-4 py-2 hidden sm:table-cell">Tier</th>
                            <th className="text-left px-4 py-2">Expires</th>
                            <th className="text-left px-4 py-2">Views</th>
                            <th className="text-left px-4 py-2">Clicks</th>
                            <th className="px-4 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {ads.map((a) => (
                            <tr key={a.id} className="border-t">
                              <td className="px-4 py-2 font-medium">{a.title}</td>
                              <td className="px-4 py-2">{a.status}</td>
                              <td className="px-4 py-2 hidden sm:table-cell">{a.format}</td>
                              <td className="px-4 py-2 hidden sm:table-cell">{a.tier}</td>
                              <td className="px-4 py-2 whitespace-nowrap">{a.expires_at ? new Date(a.expires_at).toLocaleDateString('en-GB') : '—'}</td>
                              <td className="px-4 py-2">{a.view_count ?? 0}</td>
                              <td className="px-4 py-2">{a.click_count ?? 0}</td>
                              <td className="px-4 py-2 text-right">
                                {a.tier !== 'one_off' && a.status === 'active' && (
                                  <button type="button" className="text-xs text-red-800 underline" onClick={() => void cancelSub(a.id)}>
                                    Cancel at period end
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Upgrade tier: create a new checkout from{' '}
                  <Link href="/advertiser/create-ad" className="underline">
                    Create ad
                  </Link>{' '}
                  (subscriptions can be changed after the current period ends).
                </p>
              </section>

              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-3">Billing history</h2>
                <div className="bg-white border rounded-lg overflow-hidden">
                  {invoices.length === 0 ? (
                    <p className="p-6 text-sm text-gray-500">No invoices yet.</p>
                  ) : (
                    <ul className="divide-y text-sm">
                      {invoices.map((inv) => (
                        <li key={inv.id} className="px-4 py-3 flex justify-between gap-4">
                          <span>
                            {new Date(inv.created * 1000).toLocaleDateString('en-GB')} · {inv.status} ·{' '}
                            {(inv.amount_paid / 100).toFixed(2)} {inv.currency?.toUpperCase()}
                          </span>
                          {inv.hosted_invoice_url && (
                            <a href={inv.hosted_invoice_url} className="text-amber-800 underline shrink-0" target="_blank" rel="noreferrer">
                              View
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
