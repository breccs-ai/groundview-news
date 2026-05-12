'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Menu, X } from 'lucide-react';
import { CATEGORIES } from '@/lib/supabase';
import CommentaryBanner from '@/components/CommentaryBanner';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [pathname]);

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
            <div className="pt-2 mt-1 border-t border-white/10">
              <Link
                href="#newsletter"
                className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded border border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-white transition-colors"
              >
                Subscribe to newsletter
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
    <CommentaryBanner />
    </>
  );
}
