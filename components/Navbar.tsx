'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Menu, X, ChevronDown, LogOut } from 'lucide-react';
import { CATEGORIES } from '@/lib/supabase';
import CommentaryBanner from '@/components/CommentaryBanner';
import { supabase } from '@/lib/supabase';
import { hasAdvertiserRole, hasJournalistRole } from '@/lib/profile-roles';

export default function Navbar() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const accountWrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  type AcctGate = null | {
    email: string;
    hasJournalist: boolean;
    hasAdvertiser: boolean;
  };

  const [acct, setAcct] = useState<AcctGate>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setAccountDropdownOpen(false);
  }, [pathname]);

  useEffect(() => {
    const sync = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user?.id) {
        setAcct(null);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('roles, role')
        .eq('id', user.id)
        .maybeSingle();
      setAcct({
        email: user.email?.trim() || '',
        hasJournalist: hasJournalistRole(profile),
        hasAdvertiser: hasAdvertiserRole(profile),
      });
    };

    sync();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => void sync());
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!accountDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (accountWrapRef.current && !accountWrapRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [accountDropdownOpen]);

  const handleSignOut = async () => {
    setAccountDropdownOpen(false);
    await supabase.auth.signOut();
    router.refresh();
    router.push('/');
  };

  return (
    <>
    <header
      className={`sticky top-0 z-50 transition-shadow duration-200 ${
        scrolled ? 'shadow-lg' : ''
      }`}
      style={{ backgroundColor: '#0f1f3d' }}
    >
      {/* Top bar */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 lg:h-18">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0 group">
              <span
                className="font-serif text-xl lg:text-2xl font-bold text-white tracking-tight"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                Ground View
              </span>
              <span
                className="font-serif text-xl lg:text-2xl font-bold tracking-tight ml-1"
                style={{ color: '#d4a017', fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                News
              </span>
            </Link>

            {/* Desktop nav: categories */}
            <nav className="hidden lg:flex items-center gap-1">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors duration-150 ${
                    pathname === `/category/${cat.slug}`
                      ? 'text-white bg-white/15'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cat.label}
                </Link>
              ))}
              <Link
                href="/advertiser/register"
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors duration-150 ${
                  pathname === '/advertiser/register'
                    ? 'text-white bg-white/15'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                Advertise
              </Link>
              <Link
                href="/advertiser/dashboard"
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors duration-150 ${
                  pathname === '/advertiser/dashboard'
                    ? 'text-white bg-white/15'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                Advertiser Login
              </Link>
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Search toggle */}
              <button
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Search"
                className="p-2 text-gray-300 hover:text-white transition-colors"
              >
                <Search size={18} />
              </button>

              {/* Subscribe */}
              <Link
                href="#newsletter"
                className="hidden sm:inline-flex items-center px-4 py-1.5 text-sm font-semibold rounded border border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-white transition-colors duration-150"
              >
                Subscribe
              </Link>

              {acct && (
                <div className="hidden sm:block relative" ref={accountWrapRef}>
                  <button
                    type="button"
                    onClick={() => setAccountDropdownOpen((v) => !v)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 max-w-[10rem] text-sm font-medium text-gray-300 hover:text-white border border-white/20 rounded truncate"
                  >
                    Account
                    <ChevronDown size={14} className="opacity-70 shrink-0" aria-hidden />
                  </button>
                  {accountDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 w-56 rounded-sm border border-white/15 bg-[#0a1528] shadow-xl z-50 py-1">
                      <p className="px-3 py-2 text-[11px] text-gray-500 truncate border-b border-white/10" title={acct.email}>
                        {acct.email}
                      </p>
                      <div className="py-1">
                        {acct.hasJournalist ? (
                          <Link
                            href="/journalists/dashboard"
                            className="block px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
                            onClick={() => setAccountDropdownOpen(false)}
                          >
                            My Journalist Portal
                          </Link>
                        ) : null}
                        {acct.hasAdvertiser ? (
                          <Link
                            href="/advertiser/dashboard"
                            className="block px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
                            onClick={() => setAccountDropdownOpen(false)}
                          >
                            My Advertiser Portal
                          </Link>
                        ) : null}
                        <Link
                          href="/dashboard"
                          className="block px-3 py-2 text-sm text-gray-400 hover:bg-white/10 border-t border-white/5 mt-1"
                          onClick={() => setAccountDropdownOpen(false)}
                        >
                          My dashboard
                        </Link>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSignOut()}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-amber-300 hover:bg-white/10 border-t border-white/10"
                      >
                        <LogOut size={14} aria-hidden />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle menu"
                className="lg:hidden p-2 text-gray-300 hover:text-white transition-colors"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* Search bar */}
          {searchOpen && (
            <div className="pb-3 -mt-1">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchQuery.trim()) {
                    window.location.href = `/?q=${encodeURIComponent(searchQuery.trim())}`;
                  }
                }}
                className="relative"
              >
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles..."
                  className="w-full bg-white/10 border border-white/20 rounded text-white placeholder-gray-400 px-4 py-2 text-sm focus:outline-none focus:border-amber-400"
                />
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/10" style={{ backgroundColor: '#0a1528' }}>
          <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="px-3 py-2.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                {cat.label}
              </Link>
            ))}
            <Link
              href="/advertiser/register"
              className="px-3 py-2.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              Advertise
            </Link>
            <Link
              href="/advertiser/dashboard"
              className="px-3 py-2.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              Advertiser Login
            </Link>
            <div className="pt-2 mt-1 border-t border-white/10">
              <Link
                href="#newsletter"
                className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded border border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-white transition-colors"
              >
                Subscribe to newsletter
              </Link>
            </div>
            {acct && (
              <div className="pt-4 mt-2 border-t border-white/15 space-y-1">
                <p className="px-3 text-[11px] text-gray-500 truncate">{acct.email}</p>
                <Link href="/dashboard" className="block px-3 py-2 text-sm font-medium text-amber-300">
                  Account hub
                </Link>
                {acct.hasJournalist ? (
                  <Link href="/journalists/dashboard" className="block px-3 py-2 text-sm text-gray-300 hover:text-white">
                    My Journalist Portal
                  </Link>
                ) : null}
                {acct.hasAdvertiser ? (
                  <Link href="/advertiser/dashboard" className="block px-3 py-2 text-sm text-gray-300 hover:text-white">
                    My Advertiser Portal
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleSignOut()}
                  className="w-full text-left px-3 py-2 text-sm font-semibold text-gray-400 hover:text-white flex items-center gap-2"
                >
                  <LogOut size={14} aria-hidden />
                  Sign out
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
    <CommentaryBanner />
    </>
  );
}
