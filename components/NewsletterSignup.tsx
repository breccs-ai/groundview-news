'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail } from 'lucide-react';

type Props = {
  variant?: 'section' | 'inline';
};

export default function NewsletterSignup({ variant = 'section' }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setErrorMsg('');

    const { error } = await supabase
      .from('subscribers')
      .insert({ email: email.trim().toLowerCase(), confirmed: false });

    if (error) {
      if (error.code === '23505') {
        setErrorMsg('This email is already subscribed.');
      } else {
        setErrorMsg('Something went wrong. Please try again.');
      }
      setStatus('error');
    } else {
      setStatus('success');
      setEmail('');
    }
  };

  if (variant === 'inline') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-sm p-6">
        <div className="flex items-center gap-2 mb-2">
          <Mail size={16} className="text-amber-600" />
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Newsletter
          </span>
        </div>
        <h3
          className="text-lg font-bold text-gray-900 mb-1"
          style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
        >
          Stay informed
        </h3>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          Get independent commentary on global affairs delivered to your inbox.
        </p>
        {status === 'success' ? (
          <p className="text-sm text-green-700 font-medium">Thank you — you&apos;re subscribed.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              required
              className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-gray-900 hover:bg-blue-900 text-white text-sm font-semibold py-2 rounded-sm transition-colors duration-150 disabled:opacity-60"
            >
              {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
            </button>
            {status === 'error' && <p className="text-xs text-red-600">{errorMsg}</p>}
          </form>
        )}
      </div>
    );
  }

  return (
    <section id="newsletter" className="py-16 bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <div className="flex justify-center mb-4">
          <span
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-400"
          >
            <Mail size={14} />
            Newsletter
          </span>
        </div>
        <h2
          className="text-3xl md:text-4xl font-bold text-white mb-4"
          style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
        >
          Independent analysis, in your inbox
        </h2>
        <p className="text-gray-400 text-base leading-relaxed mb-8 max-w-xl mx-auto">
          Subscribe to receive our latest commentary on Africa, world politics, human rights, and the
          global economy — no sponsored content, no agenda.
        </p>

        {status === 'success' ? (
          <div className="inline-flex items-center gap-2 bg-green-900/40 border border-green-700 text-green-300 px-6 py-3 rounded-sm text-sm">
            You&apos;re subscribed. Welcome to Ground View News.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
              className="flex-1 bg-white/10 border border-white/20 rounded-sm px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-400 transition-colors"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm rounded-sm transition-colors duration-150 whitespace-nowrap disabled:opacity-60"
            >
              {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
            </button>
          </form>
        )}
        {status === 'error' && (
          <p className="mt-3 text-red-400 text-sm">{errorMsg}</p>
        )}
      </div>
    </section>
  );
}
