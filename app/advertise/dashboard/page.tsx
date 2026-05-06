'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { Plus, CircleAlert as AlertCircle } from 'lucide-react';

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
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:          { label: 'Draft',           color: 'bg-gray-100 text-gray-700' },
  pending_review: { label: 'Pending Review',  color: 'bg-amber-100 text-amber-800' },
  approved:       { label: 'Approved',        color: 'bg-blue-100 text-blue-800' },
  active:         { label: 'Active',          color: 'bg-green-100 text-green-800' },
  rejected:       { label: 'Rejected',        color: 'bg-red-100 text-red-800' },
  expired:        { label: 'Expired',         color: 'bg-slate-100 text-slate-600' },
  discarded:      { label: 'Discarded',       color: 'bg-slate-100 text-slate-500' },
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtPrice(pence: number) {
  return `£${(pence / 100).toFixed(0)}`;
}

export default function AdvertiserDashboardPage() {
  const router = useRouter();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/advertise/login');
        return;
      }
      setUser({ email: session.user.email || '' });

      const { data } = await supabase
        .from('advertisements')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      setAds((data as Ad[]) || []);
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
        <div style={{ backgroundColor: '#0f1f3d' }} className="py-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">Advertiser Portal</p>
              <h1 className="text-2xl md:text-3xl font-bold text-white" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                My Ads
              </h1>
              {user && <p className="text-gray-400 text-sm mt-1">{user.email}</p>}
            </div>
            <div className="flex items-center gap-3">
              <Link href="/advertise/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-sm transition-colors"
                style={{ backgroundColor: '#B8860B', color: '#fff' }}>
                <Plus size={15} />
                Create New Ad
              </Link>
              <button onClick={handleSignOut}
                className="inline-flex items-center px-4 py-2.5 text-sm font-semibold border border-white/30 text-gray-300 hover:text-white rounded-sm transition-colors">
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ads.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-gray-200 rounded-sm">
              <p className="text-gray-400 text-base mb-4">You have no ads yet.</p>
              <Link href="/advertise/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-sm transition-colors"
                style={{ backgroundColor: '#B8860B', color: '#fff' }}>
                <Plus size={14} />
                Create your first ad
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {ads.map((ad) => {
                const st = STATUS_LABELS[ad.status] || { label: ad.status, color: 'bg-gray-100 text-gray-600' };
                return (
                  <div key={ad.id} className="py-5 flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-sm ${st.color}`}>
                          {st.label}
                        </span>
                        <span className="text-xs text-gray-400">{ad.package_days} days · {fmtPrice(ad.package_price_pence)}</span>
                      </div>
                      <p className="text-base font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                        {ad.title || ad.company_name || 'Untitled ad'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {ad.starts_at ? `${fmtDate(ad.starts_at)} – ${fmtDate(ad.ends_at)}` : `Created ${fmtDate(ad.created_at)}`}
                        {ad.status === 'active' && ` · ${ad.impressions.toLocaleString()} impressions`}
                      </p>
                      {ad.status === 'rejected' && ad.rejection_reason && (
                        <div className="mt-2 flex items-start gap-2 text-xs text-red-600">
                          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                          <span>{ad.rejection_reason}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {ad.status === 'draft' && (
                        <Link href={`/advertise/new?draft=${ad.id}`}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold border border-amber-500 text-amber-700 hover:bg-amber-50 rounded-sm transition-colors">
                          Complete and Submit
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
