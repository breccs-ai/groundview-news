'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { normalizedRoles, hasAdvertiserRole, hasJournalistRole } from '@/lib/profile-roles';
import {
  Newspaper,
  Megaphone,
  ChevronRight,
  LogOut,
} from 'lucide-react';

const NAVY = '#0f1f3d';
const GOLD = '#D4AF37';

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

export default function UnifiedDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [journalistSubmitted, setJournalistSubmitted] = useState<number | null>(null);
  const [journalStatus, setJournalStatus] = useState<string>('');
  const [journalEarningsThisMonth, setJournalEarningsThisMonth] = useState<number | null>(null);

  const [advertiserActive, setAdvertiserActive] = useState<number | null>(null);
  const [advertiserSpendPence, setAdvertiserSpendPence] = useState<number>(0);

  const [rolesNorm, setRolesNorm] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      router.replace('/');
      return;
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name, pen_name, subscription_status, roles, role')
      .eq('id', user.id)
      .maybeSingle();

    type P = {
      full_name?: string | null;
      pen_name?: string | null;
      subscription_status?: string | null;
    };
    const p = prof as P | null;
    const rn = normalizedRoles(prof);

    /** Single-role hubs go straight through to the specialised dashboard. */
    const hasJ = hasJournalistRole(prof);
    const hasA = hasAdvertiserRole(prof);
    if (hasJ && !hasA) {
      router.replace('/journalists/dashboard');
      return;
    }
    if (hasA && !hasJ) {
      router.replace('/advertise/dashboard');
      return;
    }

    setRolesNorm(rn);

    const nameBits = [(p?.pen_name || '').trim(), (p?.full_name || '').trim()].filter(Boolean);
    setDisplayName(nameBits[0] || user.email?.split('@')[0] || 'Ground View News member');

    const sub = ((p?.subscription_status || '').toLowerCase() === 'active' ? 'Active' : 'Pending approval');

    if (!hasJ) {
      setJournalistSubmitted(null);
      setJournalStatus('');
      setJournalEarningsThisMonth(null);
    } else {
      setJournalStatus(sub);
      const { count: jc } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', user.id);
      setJournalistSubmitted(jc ?? 0);

      const { start: ms, next: mn } = monthUtcBounds();

      let earn: number | null = null;
      const { data: monthShares } = await supabase
        .from('journalist_revenue_shares')
        .select('amount_earned')
        .eq('journalist_id', user.id)
        .gte('month_start', ms)
        .lt('month_start', mn)
        .order('month_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      earn = Number((monthShares as { amount_earned?: number } | null)?.amount_earned) || null;
      setJournalEarningsThisMonth(earn);
    }

    if (hasA) {
      const { data: ads } = await supabase
        .from('advertisements')
        .select('status, package_price_pence')
        .eq('user_id', user.id);

      const rows = (ads || []) as { status?: string | null; package_price_pence?: number | null }[];
      const st = (s: string) => (s || '').toLowerCase();
      const active = rows.filter(
        (r) => st(String(r.status)) === 'active' || st(String(r.status)) === 'approved'
      ).length;
      const spend = rows.reduce((s, r) => {
        const pence = Number(r.package_price_pence) || 0;
        const status = st(String(r.status));
        if (status === 'draft' || status === 'discarded') return s;
        return s + pence;
      }, 0);
      setAdvertiserActive(active);
      setAdvertiserSpendPence(spend);
    } else {
      setAdvertiserActive(null);
      setAdvertiserSpendPence(0);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  const hasJ = rolesNorm.includes('journalist');
  const hasA = rolesNorm.includes('advertiser');

  return (
    <>
      <Navbar />
      <main className="bg-gray-50 min-h-screen pb-16">
        <div style={{ backgroundColor: NAVY }} className="py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2">Your account</p>
              <h1
                className="text-2xl md:text-3xl font-bold text-white"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                Welcome, {displayName}
              </h1>
              <p className="text-gray-400 text-sm mt-2">Pick a workspace below.</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 border border-white/30 text-gray-300 hover:text-white rounded-sm transition-colors shrink-0"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            {hasJ && (
              <section className="bg-white rounded-sm border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2 text-[#B8860B]">
                  <Newspaper size={22} aria-hidden />
                  <h2 className="font-serif text-lg font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                    Journalist
                  </h2>
                </div>
                <ul className="text-sm text-gray-600 space-y-1.5">
                  <li>
                    <span className="text-gray-500">Articles submitted:</span>{' '}
                    <strong className="text-gray-900">{journalistSubmitted ?? '—'}</strong>
                  </li>
                  <li>
                    <span className="text-gray-500">Account:</span>{' '}
                    <strong className="text-gray-900">{journalStatus || '—'}</strong>
                  </li>
                  <li>
                    <span className="text-gray-500">Estimated earnings (this month):</span>{' '}
                    <strong className="text-gray-900">
                      {journalEarningsThisMonth === null ? '—' : formatMoneyGBP(journalEarningsThisMonth)}
                    </strong>
                  </li>
                </ul>
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Link
                    href="/journalists/dashboard"
                    className="inline-flex items-center justify-center gap-2 flex-1 py-3 px-4 text-sm font-semibold rounded-sm text-white hover:opacity-95 transition-opacity"
                    style={{ backgroundColor: NAVY }}
                  >
                    Journalist portal
                    <ChevronRight size={16} aria-hidden />
                  </Link>
                  <Link
                    href="/journalists/submit"
                    className="inline-flex items-center justify-center flex-1 py-3 px-4 text-sm font-semibold rounded-sm border border-amber-700 text-amber-900 hover:bg-amber-50 transition-colors"
                  >
                    Submit new article
                  </Link>
                </div>
              </section>
            )}

            {hasA && (
              <section className="bg-white rounded-sm border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2 text-[#B8860B]">
                  <Megaphone size={22} aria-hidden />
                  <h2 className="font-serif text-lg font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                    Advertiser
                  </h2>
                </div>
                <ul className="text-sm text-gray-600 space-y-1.5">
                  <li>
                    <span className="text-gray-500">Active ads:</span>{' '}
                    <strong className="text-gray-900">{advertiserActive ?? '—'}</strong>
                  </li>
                  <li>
                    <span className="text-gray-500">Recorded spend:</span>{' '}
                    <strong className="text-gray-900">{formatMoneyGBP(advertiserSpendPence / 100)}</strong>
                  </li>
                  <li className="text-xs text-gray-400 italic">Totals include non-draft campaigns you have booked.</li>
                </ul>
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Link
                    href="/advertise/dashboard"
                    className="inline-flex items-center justify-center gap-2 flex-1 py-3 px-4 text-sm font-semibold rounded-sm text-[#1a1a1a] hover:opacity-95 transition-opacity"
                    style={{ backgroundColor: GOLD }}
                  >
                    Advertiser portal
                    <ChevronRight size={16} aria-hidden />
                  </Link>
                  <Link
                    href="/advertise/new"
                    className="inline-flex items-center justify-center flex-1 py-3 px-4 text-sm font-semibold rounded-sm border border-gray-400 text-gray-800 hover:bg-gray-50 transition-colors"
                  >
                    Create new ad
                  </Link>
                </div>
              </section>
            )}
          </div>

          <section className="bg-white rounded-sm border border-dashed border-gray-300 px-6 py-6 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Add another role</h3>
            <p className="text-sm text-gray-700">Grow what you can do with the same Ground View News login.</p>
            <div className="flex flex-wrap gap-3">
              {!hasJ && (
                <Link
                  href="/journalists/register"
                  className="inline-flex items-center px-4 py-2.5 text-sm font-semibold rounded-sm text-white hover:opacity-95"
                  style={{ backgroundColor: NAVY }}
                >
                  Become a contributor
                </Link>
              )}
              {!hasA && (
                <Link
                  href="/advertise/register"
                  className="inline-flex items-center px-4 py-2.5 text-sm font-semibold rounded-sm text-[#1a1a1a] hover:opacity-95"
                  style={{ backgroundColor: GOLD }}
                >
                  Advertise with us
                </Link>
              )}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
