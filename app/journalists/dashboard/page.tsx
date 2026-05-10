'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CategoryBadge from '@/components/CategoryBadge';
import { supabase, getCategoryMeta } from '@/lib/supabase';
import { Plus, Eye, Pencil, ChevronDown } from 'lucide-react';

const GOLD = '#D4AF37';
const NAVY = '#0f1f3d';

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  label?: string | null;
  status: string;
  created_at: string;
  published_at: string | null;
  views?: number | null;
  rejection_reason?: string | null;
};

type ProfileRow = {
  full_name: string;
  pen_name: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
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

function monthUtcBounds(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0)).toISOString();
  const next = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0)).toISOString();
  return { start, next };
}

function formatMoneyGBP(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    published: { label: 'Published', className: 'bg-green-100 text-green-800' },
    pending: { label: 'Pending review', className: 'bg-amber-100 text-amber-900' },
    pending_editorial: {
      label: 'Editorial review',
      className: 'bg-amber-100 text-amber-900',
    },
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
    quarantined: { label: 'Quarantined', className: 'bg-orange-100 text-orange-900' },
  };
  const m = map[status] || {
    label: status.replace(/_/g, ' '),
    className: 'bg-gray-100 text-gray-600',
  };
  return (
    <span
      className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-sm capitalize ${m.className}`}
    >
      {m.label}
    </span>
  );
}

function accountStatusLabel(status: string | null | undefined): string {
  const s = (status || '').toLowerCase();
  if (s === 'active') return 'Active';
  if (s === 'pending_approval') return 'Pending Approval';
  if (s === 'suspended') return 'Suspended';
  return 'Pending Approval';
}

export default function JournalistDashboardPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalBlocked, setPortalBlocked] = useState(false);
  const [monthArticlesPublished, setMonthArticlesPublished] = useState(0);
  const [monthViewsEstimate, setMonthViewsEstimate] = useState(0);
  const [monthEarningsEstimate, setMonthEarningsEstimate] = useState<number | null>(null);
  const [monthShareWeightedViews, setMonthShareWeightedViews] = useState<number | null>(null);

  const [totalPublished, setTotalPublished] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [totalPaidEarnings, setTotalPaidEarnings] = useState(0);

  const [revenueShareRowCount, setRevenueShareRowCount] = useState<number | null>(null);
  const [submittedThisMonth, setSubmittedThisMonth] = useState(0);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      router.push('/journalists/login');
      return;
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, pen_name, subscription_status, subscription_tier, created_at, role')
      .eq('id', user.id)
      .maybeSingle();

    const role = (prof as { role?: string } | null)?.role;
    if (role !== 'journalist') {
      setPortalBlocked(true);
      setProfile((prof as ProfileRow) || null);
      setArticles([]);
      setLoading(false);
      return;
    }
    setPortalBlocked(false);

    setProfile((prof as ProfileRow) || null);

    const { data: arts, error: artsErr } = await supabase
      .from('articles')
      .select(
        'id, title, slug, category, label, status, created_at, published_at, views, rejection_reason'
      )
      .eq('author_id', user.id)
      .order('created_at', { ascending: false });

    if (artsErr) {
      console.error('[journalist dashboard] articles', artsErr.message);
      setArticles([]);
    } else {
      setArticles((arts as ArticleRow[]) || []);
    }

    const { start: monthStart, next: monthNext } = monthUtcBounds();

    const { count: pubMonth } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', user.id)
      .eq('status', 'published')
      .gte('published_at', monthStart)
      .lt('published_at', monthNext);

    setMonthArticlesPublished(pubMonth ?? 0);

    const { count: subMonth } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', user.id)
      .gte('created_at', monthStart)
      .lt('created_at', monthNext);

    setSubmittedThisMonth(subMonth ?? 0);

    const { data: pubArts } = await supabase
      .from('articles')
      .select('views')
      .eq('author_id', user.id)
      .eq('status', 'published');

    const allPub = (pubArts || []) as { views?: number | null }[];
    setTotalPublished(allPub.length);
    const sumViews = allPub.reduce((s, a) => s + (Number(a.views) || 0), 0);
    setTotalViews(sumViews);

    const { count: shareTotal, error: shareCntErr } = await supabase
      .from('journalist_revenue_shares')
      .select('*', { count: 'exact', head: true })
      .eq('journalist_id', user.id);

    setRevenueShareRowCount(shareCntErr ? null : shareTotal ?? 0);

    const { data: monthShares } = await supabase
      .from('journalist_revenue_shares')
      .select('amount_earned, weighted_views, month_start')
      .eq('journalist_id', user.id)
      .gte('month_start', monthStart)
      .lt('month_start', monthNext)
      .order('month_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    type ShareRow = { amount_earned?: number; weighted_views?: number };
    const ms = monthShares as ShareRow | null;

    if (ms) {
      setMonthEarningsEstimate(Number(ms.amount_earned) || 0);
      setMonthShareWeightedViews(Number(ms.weighted_views) || 0);
      setMonthViewsEstimate(Number(ms.weighted_views) || 0);
    } else {
      const { data: monthArts } = await supabase
        .from('articles')
        .select('views')
        .eq('author_id', user.id)
        .eq('status', 'published')
        .gte('published_at', monthStart)
        .lt('published_at', monthNext);

      const mv = ((monthArts || []) as { views?: number | null }[]).reduce(
        (s, a) => s + (Number(a.views) || 0),
        0
      );
      setMonthViewsEstimate(mv);
      setMonthEarningsEstimate(null);
      setMonthShareWeightedViews(null);
    }

    const { data: paidShares } = await supabase
      .from('journalist_revenue_shares')
      .select('amount_earned, status')
      .eq('journalist_id', user.id);

    const rows = (paidShares || []) as { amount_earned?: number; status?: string }[];
    const paidSum = rows
      .filter((r) => (r.status || '').toLowerCase() === 'paid')
      .reduce((s, r) => s + (Number(r.amount_earned) || 0), 0);
    setTotalPaidEarnings(paidSum);

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/journalists/login');
  };

  const isApproved = (profile?.subscription_status || '') === 'active';

  if (portalBlocked) {
    return (
      <>
        <Navbar />
        <main className="bg-white min-h-screen">
          <div style={{ backgroundColor: NAVY }} className="py-10">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-start justify-between gap-4">
              <p className="text-sm text-gray-300">
                Wrong portal for this account.{' '}
                <Link href="/journalists/login" className="text-amber-400 underline font-semibold">
                  Sign in with a journalist account
                </Link>
              </p>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-sm font-semibold px-4 py-2 border border-white/30 text-gray-300 hover:text-white rounded-sm shrink-0"
              >
                Sign Out
              </button>
            </div>
          </div>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-4">
            <p className="text-gray-900 font-medium">
              This email is registered as an advertiser account. Please use your journalist account.
            </p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="bg-white min-h-screen">
        <div style={{ backgroundColor: NAVY }} className="py-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">
                Journalist Portal
              </p>
              <h1
                className="text-2xl md:text-3xl font-bold text-white"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                Dashboard
              </h1>
              {profile && (
                <p className="text-gray-400 text-sm mt-1">
                  Welcome, {profile.pen_name || profile.full_name}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
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

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">
          {/* Quick actions */}
          <section className="flex flex-wrap gap-3 items-center">
            <Link
              href="/journalists/submit"
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-sm text-[#1a1a1a] shadow-sm transition-colors hover:opacity-95"
              style={{ backgroundColor: GOLD }}
            >
              <Plus size={16} />
              Submit New Article
            </Link>
            <Link
              href="/journalists/articles"
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-sm border border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors"
            >
              View Published Articles
            </Link>
            <Link
              href="/editorial-policy"
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-sm border border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors"
            >
              Editorial Guidelines
            </Link>
          </section>

          {/* Account status */}
          {profile && (
            <section className="p-6 bg-gray-50 border border-gray-200 rounded-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">
                  Account status
                </p>
                <p className="font-semibold text-gray-900">{accountStatusLabel(profile.subscription_status)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">
                  Subscription tier
                </p>
                <p className="font-semibold text-gray-900 capitalize">
                  {profile.subscription_tier?.trim() || 'Free'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">
                  Member since
                </p>
                <p className="font-semibold text-gray-900">{fmtDate(profile.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">
                  Articles submitted this month
                </p>
                <p className="font-semibold text-gray-900">{submittedThisMonth}</p>
              </div>
              {!isApproved && (
                <div className="sm:col-span-2 lg:col-span-4 pt-2 border-t border-gray-200">
                  <p className="text-sm text-gray-700">
                    Your journalist account is awaiting editorial approval. You’ll receive an email within 48 hours.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Earnings */}
          <section className="border border-gray-200 rounded-sm overflow-hidden">
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-widest">
                Earnings
              </h2>
            </div>
            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-8 text-sm">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                  Current month
                </h3>
                <ul className="space-y-2 text-gray-800">
                  <li>
                    <span className="text-gray-500">Articles published (this month):</span>{' '}
                    <span className="font-semibold">{monthArticlesPublished}</span>
                  </li>
                  <li>
                    <span className="text-gray-500">
                      {monthShareWeightedViews != null ? 'Weighted views (statement):' : 'Views (on articles published this month):'}
                    </span>{' '}
                    <span className="font-semibold">
                      {monthShareWeightedViews != null
                        ? Math.round(monthShareWeightedViews)
                        : monthViewsEstimate}
                    </span>
                  </li>
                  <li>
                    <span className="text-gray-500">Estimated earnings:</span>{' '}
                    <span className="font-semibold">
                      {monthEarningsEstimate != null
                        ? formatMoneyGBP(monthEarningsEstimate)
                        : '—'}
                    </span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                  All time
                </h3>
                <ul className="space-y-2 text-gray-800">
                  <li>
                    <span className="text-gray-500">Total articles published:</span>{' '}
                    <span className="font-semibold">{totalPublished}</span>
                  </li>
                  <li>
                    <span className="text-gray-500">Total views (all articles):</span>{' '}
                    <span className="font-semibold">{totalViews}</span>
                  </li>
                  <li>
                    <span className="text-gray-500">Total earnings paid:</span>{' '}
                    <span className="font-semibold">{formatMoneyGBP(totalPaidEarnings)}</span>
                  </li>
                </ul>
              </div>
            </div>
            {revenueShareRowCount === 0 ? (
              <div className="px-5 pb-5">
                <p className="text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-sm px-4 py-3">
                  Earnings are calculated on the 1st of each month based on your article performance.
                  Keep publishing to start earning.
                </p>
              </div>
            ) : null}
          </section>

          {/* Articles */}
          <section>
            <h2
              className="text-lg font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              My articles
            </h2>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : articles.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-gray-200 rounded-sm">
                <p className="text-gray-400 text-base mb-4">You have not submitted any articles yet.</p>
                <Link
                  href="/journalists/submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-sm text-[#1a1a1a]"
                  style={{ backgroundColor: GOLD }}
                >
                  <Plus size={14} />
                  Submit your first article
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {articles.map((article) => {
                  const cat = getCategoryMeta(article.category);
                  const canPublicLink = article.status === 'published' && article.slug;
                  const isDraft = article.status === 'draft';

                  return (
                    <div
                      key={article.id}
                      className="border border-gray-200 rounded-sm bg-white overflow-hidden"
                    >
                      <div className="p-4 flex flex-col lg:flex-row lg:items-center gap-4 lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <CategoryBadge category={article.category} label={article.label || cat.label} />
                            {statusBadge(article.status)}
                          </div>
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            {canPublicLink ? (
                              <Link
                                href={`/articles/${article.slug}`}
                                className="text-lg font-bold text-gray-900 hover:text-amber-800 transition-colors break-words"
                                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                              >
                                {article.title}
                              </Link>
                            ) : (
                              <span
                                className="text-lg font-bold text-gray-900 break-words"
                                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                              >
                                {article.title}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                            <span>
                              {article.published_at
                                ? `Published ${fmtDate(article.published_at)}`
                                : 'Draft'}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Eye size={14} className="text-gray-400" />
                              {Number(article.views) || 0}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {isDraft && (
                            <Link
                              href={`/journalists/submit?id=${encodeURIComponent(article.id)}`}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-sm border border-gray-300 text-gray-800 hover:bg-gray-50"
                            >
                              <Pencil size={14} />
                              Edit
                            </Link>
                          )}
                        </div>
                      </div>

                      {article.status === 'rejected' && article.rejection_reason?.trim() ? (
                        <details className="group border-t border-gray-100 bg-red-50/40 px-4 py-2">
                          <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-red-900 list-none [&::-webkit-details-marker]:hidden">
                            <ChevronDown
                              size={16}
                              className="transition-transform group-open:rotate-180 text-red-700"
                            />
                            Rejection reason
                          </summary>
                          <p className="mt-2 text-sm text-red-950 pl-7 pb-2">{article.rejection_reason}</p>
                        </details>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
