'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Menu, X, ChevronDown, LogOut } from 'lucide-react';
import { CATEGORIES } from '@/lib/supabase';
import CommentaryBanner from '@/components/CommentaryBanner';
import { supabase } from '@/lib/supabase';
import { hasAdvertiserRole, hasJournalistRole } from '@/lib/profile-roles';

type AcctGate = null | {
  email: string;
  hasJournalist: boolean;
  hasAdvertiser: boolean;
};

const NAVY = '#0f1f3d';

const PRIMARY_LINKS: { href: string; label: string }[] = [
  { href: '/about', label: 'About' },
  { href: '/write-for-us', label: 'Write for Us' },
  { href: '/advertiser/register', label: 'Advertise' },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);

  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileSectionsOpen, setMobileSectionsOpen] = useState(false);

  const sectionsRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const [acct, setAcct] = useState<AcctGate>(null);

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setMobileSectionsOpen(false);
    setSearchOpen(false);
    setAccountOpen(false);
    setSectionsOpen(false);
  }, [pathname]);

  // Shadow on scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

  // Load session for the Account control
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

  // Click-outside for desktop dropdowns
  useEffect(() => {
    if (!sectionsOpen && !accountOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (sectionsOpen && sectionsRef.current && !sectionsRef.current.contains(target)) {
        setSectionsOpen(false);
      }
      if (accountOpen && accountRef.current && !accountRef.current.contains(target)) {
        setAccountOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [sectionsOpen, accountOpen]);

  // Close dropdowns on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSectionsOpen(false);
        setAccountOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSignOut = async () => {
    setAccountOpen(false);
    setMobileOpen(false);
    await supabase.auth.signOut();
    router.refresh();
    router.push('/');
  };

  const sectionsLinkClass =
    'text-sm font-medium text-gray-100 hover:text-white transition-colors';

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-shadow duration-200 ${scrolled ? 'shadow-lg' : ''}`}
        style={{ backgroundColor: NAVY }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0 group min-w-0" aria-label="Ground View News home">
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

            {/* Desktop primary nav */}
            <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center" aria-label="Primary">
              {/* Sections dropdown */}
              <div ref={sectionsRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSectionsOpen((v) => !v)}
                  aria-expanded={sectionsOpen}
                  aria-haspopup="true"
                  className={`inline-flex items-center gap-1 px-3 py-2 rounded ${sectionsLinkClass} hover:bg-white/10`}
                >
                  Sections
                  <ChevronDown
                    size={14}
                    className={`opacity-80 transition-transform ${sectionsOpen ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>
                {sectionsOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full mt-2 w-[28rem] max-w-[calc(100vw-2rem)] rounded-sm bg-[#0a1528] border border-white/15 shadow-2xl p-2 z-50"
                  >
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      {CATEGORIES.map((cat) => (
                        <Link
                          key={cat.slug}
                          href={`/category/${cat.slug}`}
                          role="menuitem"
                          onClick={() => setSectionsOpen(false)}
                          className="block px-3 py-2 rounded-sm text-sm text-gray-100 hover:bg-white/10 hover:text-white transition-colors"
                        >
                          {cat.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {PRIMARY_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded transition-colors ${sectionsLinkClass} ${
                    pathname === link.href || pathname?.startsWith(`${link.href}/`)
                      ? 'bg-white/15 text-white'
                      : 'hover:bg-white/10'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              <Link
                href="#newsletter"
                className={`px-3 py-2 rounded transition-colors ${sectionsLinkClass} hover:bg-white/10`}
              >
                Subscribe
              </Link>

              <div ref={accountRef} className="relative">
                {acct ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setAccountOpen((v) => !v)}
                      aria-expanded={accountOpen}
                      aria-haspopup="true"
                      className={`inline-flex items-center gap-1 px-3 py-2 rounded ${sectionsLinkClass} hover:bg-white/10`}
                    >
                      Account
                      <ChevronDown
                        size={14}
                        className={`opacity-80 transition-transform ${accountOpen ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                    </button>
                    {accountOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 top-full mt-2 w-56 rounded-sm border border-white/15 bg-[#0a1528] shadow-2xl py-1 z-50"
                      >
                        <p
                          className="px-3 py-2 text-[11px] text-gray-300 truncate border-b border-white/10"
                          title={acct.email}
                        >
                          {acct.email}
                        </p>
                        {acct.hasJournalist && (
                          <Link
                            href="/journalists/dashboard"
                            role="menuitem"
                            onClick={() => setAccountOpen(false)}
                            className="block px-3 py-2 text-sm text-gray-100 hover:bg-white/10 hover:text-white"
                          >
                            My Writer Portal
                          </Link>
                        )}
                        {acct.hasAdvertiser && (
                          <Link
                            href="/advertiser/dashboard"
                            role="menuitem"
                            onClick={() => setAccountOpen(false)}
                            className="block px-3 py-2 text-sm text-gray-100 hover:bg-white/10 hover:text-white"
                          >
                            My Advertiser Portal
                          </Link>
                        )}
                        <Link
                          href="/dashboard"
                          role="menuitem"
                          onClick={() => setAccountOpen(false)}
                          className="block px-3 py-2 text-sm text-gray-200 hover:bg-white/10 hover:text-white border-t border-white/5"
                        >
                          My dashboard
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleSignOut()}
                          role="menuitem"
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-amber-300 hover:bg-white/10 border-t border-white/10"
                        >
                          <LogOut size={14} aria-hidden />
                          Sign out
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href="/journalists/login"
                    className={`px-3 py-2 rounded transition-colors ${sectionsLinkClass} hover:bg-white/10`}
                  >
                    Account
                  </Link>
                )}
              </div>
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Search"
                aria-expanded={searchOpen}
                className="p-2 min-w-11 min-h-11 inline-flex items-center justify-center rounded text-gray-100 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Search size={20} />
              </button>

              {/* Mobile menu toggle */}
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                className="lg:hidden p-2 min-w-11 min-h-11 inline-flex items-center justify-center rounded text-gray-100 hover:text-white hover:bg-white/10 transition-colors"
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>

          {/* Search overlay */}
          {searchOpen && (
            <div className="pb-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchQuery.trim()) {
                    window.location.href = `/?q=${encodeURIComponent(searchQuery.trim())}`;
                  }
                }}
                className="relative"
                role="search"
              >
                <input
                  autoFocus
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles..."
                  aria-label="Search articles"
                  className="w-full bg-white/10 border border-white/30 rounded text-white placeholder-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400"
                />
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Site menu">
          <button
            type="button"
            aria-label="Close menu overlay"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div
            className="absolute top-0 right-0 bottom-0 w-full max-w-sm flex flex-col text-gray-100 shadow-2xl"
            style={{ backgroundColor: '#0a1528' }}
          >
            <div className="flex items-center justify-between h-16 px-4 border-b border-white/10 flex-shrink-0">
              <span
                className="font-serif text-lg font-bold text-white"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                Menu
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="p-2 min-w-11 min-h-11 inline-flex items-center justify-center rounded hover:bg-white/10"
              >
                <X size={22} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Mobile">
              <ul className="flex flex-col gap-1">
                {PRIMARY_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block px-3 py-3 min-h-11 text-base font-medium text-gray-100 hover:text-white hover:bg-white/10 rounded"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="#newsletter"
                    className="block px-3 py-3 min-h-11 text-base font-medium text-gray-100 hover:text-white hover:bg-white/10 rounded"
                  >
                    Subscribe
                  </Link>
                </li>

                {/* Account block — mobile */}
                <li className="border-t border-white/10 mt-2 pt-2">
                  {acct ? (
                    <div className="flex flex-col gap-1">
                      <p className="px-3 text-xs text-gray-300 truncate">{acct.email}</p>
                      {acct.hasJournalist && (
                        <Link
                          href="/journalists/dashboard"
                          className="block px-3 py-3 min-h-11 text-sm font-medium text-gray-100 hover:text-white hover:bg-white/10 rounded"
                        >
                          My Writer Portal
                        </Link>
                      )}
                      {acct.hasAdvertiser && (
                        <Link
                          href="/advertiser/dashboard"
                          className="block px-3 py-3 min-h-11 text-sm font-medium text-gray-100 hover:text-white hover:bg-white/10 rounded"
                        >
                          My Advertiser Portal
                        </Link>
                      )}
                      <Link
                        href="/dashboard"
                        className="block px-3 py-3 min-h-11 text-sm font-medium text-gray-200 hover:text-white hover:bg-white/10 rounded"
                      >
                        My dashboard
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleSignOut()}
                        className="w-full flex items-center gap-2 px-3 py-3 min-h-11 text-sm font-semibold text-amber-300 hover:bg-white/10 rounded"
                      >
                        <LogOut size={14} aria-hidden />
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <Link
                      href="/journalists/login"
                      className="block px-3 py-3 min-h-11 text-base font-medium text-gray-100 hover:text-white hover:bg-white/10 rounded"
                    >
                      Account
                    </Link>
                  )}
                </li>

                {/* Sections accordion */}
                <li className="border-t border-white/10 mt-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMobileSectionsOpen((v) => !v)}
                    aria-expanded={mobileSectionsOpen}
                    aria-controls="mobile-sections"
                    className="w-full flex items-center justify-between px-3 py-3 min-h-11 text-base font-medium text-gray-100 hover:text-white hover:bg-white/10 rounded"
                  >
                    Sections
                    <ChevronDown
                      size={16}
                      className={`opacity-80 transition-transform ${mobileSectionsOpen ? 'rotate-180' : ''}`}
                      aria-hidden
                    />
                  </button>
                  {mobileSectionsOpen && (
                    <ul id="mobile-sections" className="flex flex-col gap-0.5 pb-2">
                      {CATEGORIES.map((cat) => (
                        <li key={cat.slug}>
                          <Link
                            href={`/category/${cat.slug}`}
                            className="block pl-6 pr-3 py-3 min-h-11 text-sm text-gray-200 hover:text-white hover:bg-white/10 rounded"
                          >
                            {cat.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              </ul>
            </nav>

            <div className="border-t border-white/10 px-2 py-3 flex-shrink-0">
              <Link
                href="/advertiser/dashboard"
                className="block px-3 py-3 min-h-11 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 rounded"
              >
                Advertiser Login
              </Link>
            </div>
          </div>
        </div>
      )}

      <CommentaryBanner />
    </>
  );
}
