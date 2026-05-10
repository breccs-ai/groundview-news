'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { Plus, MousePointerClick } from 'lucide-react';

const NAVY = '#0f1f3d';
const GOLD = '#D4AF37';

type Ad = {
  id: string;
  company_name: string;
  title: string;
  package_days: number;
  package_price_pence: number;
  status: string;
  rejection_reason: string | null;
  starts_at: string | null;
  ends_at: string | null;
  impressions: number;
  clicks?: number | null;
  created_at: string;
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtPrice(pence: number) {
  return `£${(pence / 100).toFixed(0)}`;
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'pending_review' || s === 'pending' || s === 'draft') {
    const label =
      s === 'draft'
        ? 'Draft'
        : s === 'pending_review'
          ? 'Pending'
          : 'Pending';
    return (
      <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-sm bg-gray-100 text-gray-700">
        {label}
      </span>
    );
  }
  if (s === 'active' || s === 'approved') {
    return (
      <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-sm bg-green-100 text-green-800">
        Active
      </span>
    );
  }
  if (s === 'expired' || s === 'discarded') {
    return (
      <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-sm bg-red-100 text-red-800">
        {s === 'expired' ? 'Expired' : 'Discarded'}
      </span>
    );
  }
  if (s === 'rejected') {
    return (
      <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-sm bg-red-100 text-red-800">
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-sm bg-gray-100 text-gray-600 capitalize">
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function AdvertiserDashboardPage() {
  const router = useRouter();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email: string } | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) {
        router.push('/advertise/login');
        return;
      }

      setUser({ email: u.email || '' });

      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[advertise dashboard]', error.message);
        setAds([]);
      } else {
        setAds((data as Ad[]) || []);
      }
      setLoading(false);
    })();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/advertise/login');
  };

  return (
    <>
      <Navbar />
      <main className="bg-white min-h-screen">
        <div style={{ backgroundColor: NAVY }} className="py-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">
                Advertiser Portal
              </p>
              <h1
                className="text-2xl md:text-3xl font-bold text-white"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                My Ads
              </h1>
              {user && <p className="text-gray-400 text-sm mt-1">{user.email}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/advertise/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-sm transition-colors text-[#1a1a1a]"
                style={{ backgroundColor: GOLD }}
              >
                <Plus size={15} />
                Create New Ad
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center px-4 py-2.5 text-sm font-semibold border border-white/30 text-gray-300 hover:text-white rounded-sm transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="mb-8">
            <Link
              href="/advertise/new"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-sm text-[#1a1a1a] shadow-sm hover:opacity-95 transition-opacity"
              style={{ backgroundColor: GOLD }}
            >
              <Plus size={16} />
              Create New Ad
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ads.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-gray-200 rounded-sm">
              <p className="text-gray-400 text-base mb-4">You have no ads yet.</p>
              <Link
                href="/advertise/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-sm text-[#1a1a1a]"
                style={{ backgroundColor: GOLD }}
              >
                <Plus size={14} />
                Create your first ad
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {ads.map((ad) => {
                const isActive = ad.status === 'active';
                const clicks =
                  typeof ad.clicks === 'number' && Number.isFinite(ad.clicks) ? ad.clicks : null;

                return (
                  <div
                    key={ad.id}
                    className="border border-gray-200 rounded-sm p-5 flex flex-col lg:flex-row lg:items-start gap-6 bg-white shadow-sm"
                  >
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {statusBadge(ad.status)}
                        <span className="text-xs text-gray-400">
                          {ad.package_days} days · {fmtPrice(ad.package_price_pence)}
                        </span>
                      </div>
                      <p
                        className="text-sm text-gray-500"
                      >
                        <span className="font-semibold text-gray-800">{ad.company_name}</span>
                      </p>
                      <p
                        className="text-lg font-bold text-gray-900"
                        style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                      >
                        {ad.title || 'Untitled ad'}
                      </p>
                      <p className="text-xs text-gray-600">
                        {ad.starts_at && ad.ends_at
                          ? `${fmtDate(ad.starts_at)} – ${fmtDate(ad.ends_at)}`
                          : `Created ${fmtDate(ad.created_at)}`}
                      </p>
                      {isActive && (
                        <div className="flex flex-wrap gap-4 text-xs text-gray-600 pt-1">
                          <span>
                            Impressions:{' '}
                            <strong className="text-gray-900">
                              {(ad.impressions ?? 0).toLocaleString()}
                            </strong>
                          </span>
                          {clicks !== null ? (
                            <span className="inline-flex items-center gap-1">
                              <MousePointerClick size={14} className="text-gray-400" />
                              Clicks:{' '}
                              <strong className="text-gray-900">{clicks.toLocaleString()}</strong>
                            </span>
                          ) : (
                            <span className="text-gray-400">Clicks: —</span>
                          )}
                        </div>
                      )}
                      {ad.status === 'rejected' && ad.rejection_reason && (
                        <p className="text-xs text-red-700 mt-2">{ad.rejection_reason}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {ad.status === 'draft' && (
                        <Link
                          href={`/advertise/new?draft=${ad.id}`}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold border border-amber-500 text-amber-800 hover:bg-amber-50 rounded-sm transition-colors"
                        >
                          Continue ad
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
