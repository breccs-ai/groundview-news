'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';

const RESET_REDIRECT = 'https://groundviewnews.com/advertiser/reset-password';

export default function AdvertiserLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'sent'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.replace('/advertiser/dashboard');
    router.refresh();
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setResetStatus('loading');
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: RESET_REDIRECT,
    });
    if (error) {
      console.error('[advertiser/login] resetPasswordForEmail', error);
    }
    setResetStatus('sent');
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-stone-50">
        <div className="max-w-md mx-auto px-4 py-14">
          <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            Advertiser sign in
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            <Link href="/advertiser/register" className="text-amber-800 underline">
              Need an account? Register
            </Link>
          </p>

          {!showForgot ? (
            <form onSubmit={(e) => void signIn(e)} className="bg-white border border-stone-200 rounded-lg p-6 space-y-4 shadow-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button type="button" className="text-xs text-amber-900 underline mt-1.5" onClick={() => setShowForgot(true)}>
                  Forgot password?
                </button>
              </div>
              {errorMsg && <p className="text-sm text-red-700">{errorMsg}</p>}
              <button type="submit" disabled={busy} className="w-full py-3 rounded-md bg-[#0f1f3d] text-white font-semibold text-sm disabled:opacity-60">
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          ) : (
            <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4 shadow-sm">
              <button type="button" className="text-xs text-gray-600 underline" onClick={() => { setShowForgot(false); setResetStatus('idle'); }}>
                ← Back to sign in
              </button>
              {resetStatus === 'sent' ? (
                <p className="text-sm text-gray-800 leading-relaxed">
                  If an account exists for this email address you will receive a reset link shortly.
                </p>
              ) : (
                <form onSubmit={(e) => void sendReset(e)} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Email address *</label>
                    <input
                      type="email"
                      required
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  {errorMsg && <p className="text-sm text-red-700">{errorMsg}</p>}
                  <button
                    type="submit"
                    disabled={resetStatus === 'loading'}
                    className="w-full py-3 rounded-md bg-amber-700 text-white font-semibold text-sm disabled:opacity-60"
                  >
                    {resetStatus === 'loading' ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
