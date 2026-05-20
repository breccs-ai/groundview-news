import Link from 'next/link';
import { Twitter, Linkedin, Facebook, Youtube } from 'lucide-react';
import { CATEGORIES } from '@/lib/supabase';
import AdSlot from '@/components/ads/AdSlot';

// Brighter text color than the previous text-gray-400/500 to meet WCAG AA
// contrast on the navy (#0f1f3d) background.
const linkClass =
  'block text-sm text-gray-200 hover:text-white transition-colors py-1 leading-snug';
const colHeading =
  'text-white text-xs font-semibold uppercase tracking-widest mb-4';

export default function Footer() {
  return (
    <footer style={{ backgroundColor: '#0f1f3d' }} className="text-gray-200 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        <AdSlot zone="footer" variant="footer" />
      </div>

      {/* Brand strip */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-8 border-b border-white/10">
          <div className="max-w-xl">
            <div className="mb-3">
              <span
                className="font-serif text-2xl font-bold text-white"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                Ground View
              </span>
              <span
                className="font-serif text-2xl font-bold ml-1"
                style={{ color: '#d4a017', fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                News
              </span>
            </div>
            <p className="text-sm text-gray-200 leading-relaxed">
              Independent commentary on global affairs. No geographic bias. No agenda.
              Ground up. Not top down.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter / X"
              className="w-11 h-11 inline-flex items-center justify-center rounded text-gray-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Twitter size={18} />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="w-11 h-11 inline-flex items-center justify-center rounded text-gray-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Linkedin size={18} />
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="w-11 h-11 inline-flex items-center justify-center rounded text-gray-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Facebook size={18} />
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              className="w-11 h-11 inline-flex items-center justify-center rounded text-gray-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Youtube size={18} />
            </a>
          </div>
        </div>
      </div>

      {/* 4-column link grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
          {/* Column 1 — Sections (all 15) */}
          <div>
            <h4 className={colHeading}>Sections</h4>
            <ul className="space-y-0.5">
              {CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link href={`/category/${cat.slug}`} className={linkClass}>
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2 — Publication */}
          <div>
            <h4 className={colHeading}>Publication</h4>
            <ul className="space-y-0.5">
              <li>
                <Link href="/about" className={linkClass}>
                  About
                </Link>
              </li>
              <li>
                <Link href="/editorial-policy" className={linkClass}>
                  Editorial Policy
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className={linkClass}>
                  Editorial Disclaimer
                </Link>
              </li>
              <li>
                <Link href="/write-for-us" className={linkClass}>
                  Write for Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className={linkClass}>
                  Contact
                </Link>
              </li>
              <li>
                <a
                  href="mailto:info@groundviewnews.com"
                  className="block text-sm text-gray-200 hover:text-white transition-colors py-1 leading-snug break-all"
                >
                  info@groundviewnews.com
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3 — Advertising */}
          <div>
            <h4 className={colHeading}>Advertising</h4>
            <ul className="space-y-0.5">
              <li>
                <Link href="/advertiser/register" className={linkClass}>
                  Advertise With Us
                </Link>
              </li>
              <li>
                <Link href="/advertiser/dashboard" className={linkClass}>
                  Advertiser Login
                </Link>
              </li>
              <li>
                <Link href="/legal/advertiser-terms" className={linkClass}>
                  Advertiser Terms
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4 — Account */}
          <div>
            <h4 className={colHeading}>Account</h4>
            <ul className="space-y-0.5">
              <li>
                <Link href="#newsletter" className={linkClass}>
                  Subscribe
                </Link>
              </li>
              <li>
                <Link href="/journalists/login" className={linkClass}>
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/journalists/dashboard" className={linkClass}>
                  Writer Portal
                </Link>
              </li>
              <li>
                <Link href="/write-for-us" className={linkClass}>
                  Write for Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-10 text-xs text-gray-300 leading-relaxed max-w-3xl">
          Ground View News publishes independent commentary and opinion. Articles reflect the views
          of individual authors.{' '}
          <Link href="/disclaimer" className="underline text-gray-100 hover:text-white transition-colors">
            Editorial disclaimer
          </Link>
          .
        </p>
      </div>

      {/* Copyright bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-300">
          <p>&copy; 2026 Ground View News. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center sm:justify-end">
            <Link href="/privacy-policy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms &amp; Conditions
            </Link>
            <Link href="/disclaimer" className="hover:text-white transition-colors">
              Editorial Disclaimer
            </Link>
            <Link href="/privacy-policy#cookies" className="hover:text-white transition-colors">
              Cookie Policy
            </Link>
            <Link href="/editorial-policy" className="hover:text-white transition-colors">
              Editorial Policy
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </div>

      {/* Staff login — intentionally small + low contrast */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4 text-center">
        <Link
          href="/admin"
          className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
        >
          Staff login
        </Link>
      </div>
    </footer>
  );
}
