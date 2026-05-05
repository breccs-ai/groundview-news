'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Cookie } from 'lucide-react';

const CONSENT_KEY = 'gvn_cookie_consent';

type ConsentValue = 'accepted' | 'essential';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const respond = (choice: ConsentValue) => {
    localStorage.setItem(CONSENT_KEY, choice);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
    >
      <div className="bg-gray-950 border-t border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Icon + text */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 mt-0.5">
                <Cookie size={18} className="text-amber-400" />
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                We use essential cookies to make this site work. We&rsquo;d also like to use
                analytics cookies to understand how you use the site. See our{' '}
                <Link
                  href="/privacy-policy#cookies"
                  className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
                >
                  Cookie Policy
                </Link>{' '}
                for details.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => respond('essential')}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white border border-white/20 hover:border-white/40 rounded-sm transition-colors"
              >
                Essential only
              </button>
              <button
                onClick={() => respond('accepted')}
                className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-sm transition-colors"
              >
                Accept all
              </button>
              <button
                onClick={() => respond('essential')}
                aria-label="Use essential cookies only"
                className="p-1.5 text-gray-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
