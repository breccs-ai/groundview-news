import Link from 'next/link';
import { Twitter, Linkedin, Facebook, Youtube } from 'lucide-react';
import { CATEGORIES } from '@/lib/supabase';

export default function Footer() {
  return (
    <footer style={{ backgroundColor: '#0f1f3d' }} className="text-gray-300 mt-20">
      {/* Top section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="mb-4">
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
            <p className="text-sm text-gray-400 leading-relaxed max-w-sm">
              Independent commentary on global affairs: human rights, world politics, and the global
              economy. No geographic bias. No agenda. Ground up. Not top down.
            </p>
            <div className="flex gap-4 mt-6">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter / X"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Twitter size={18} />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Linkedin size={18} />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Facebook size={18} />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Youtube size={18} />
              </a>
            </div>
            <p className="mt-6 text-xs text-gray-600 leading-relaxed max-w-sm">
              Ground View News publishes independent commentary and opinion. Articles reflect the
              views of individual authors.{' '}
              <Link href="/disclaimer" className="underline hover:text-gray-400 transition-colors">
                Editorial disclaimer
              </Link>
              .
            </p>
          </div>

          {/* Sections */}
          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-widest mb-4">
              Sections
            </h4>
            <ul className="space-y-2.5">
              {CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`/category/${cat.slug}`}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Publication */}
          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-widest mb-4">
              Publication
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/about" className="text-sm text-gray-400 hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/editorial-policy"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Editorial Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/disclaimer"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Editorial Disclaimer
                </Link>
              </li>
              <li>
                <Link
                  href="/advertise"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Advertise
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Contact
                </Link>
              </li>
              <li>
                <a
                  href="mailto:info@groundviewnews.com"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  info@groundviewnews.com
                </a>
              </li>
            </ul>
            <h4 className="text-white text-xs font-semibold uppercase tracking-widest mb-4 mt-8">
              Advertising
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/advertiser/register"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Advertise With Us
                </Link>
              </li>
              <li>
                <Link
                  href="/advertiser/dashboard"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Advertiser Login
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/advertiser-terms"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Advertiser Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-500">
          <p>&copy; 2026 Ground View News. All rights reserved.</p>
          <div className="flex flex-wrap gap-4 justify-center sm:justify-end">
            <Link href="/privacy-policy" className="hover:text-gray-300 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">
              Terms &amp; Conditions
            </Link>
            <Link href="/disclaimer" className="hover:text-gray-300 transition-colors">
              Editorial Disclaimer
            </Link>
            <Link href="/privacy-policy#cookies" className="hover:text-gray-300 transition-colors">
              Cookie Policy
            </Link>
            <Link href="/editorial-policy" className="hover:text-gray-300 transition-colors">
              Editorial Policy
            </Link>
            <Link href="/contact" className="hover:text-gray-300 transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
