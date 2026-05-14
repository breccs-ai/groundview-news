'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';

const PW_RULES = 'Minimum 8 characters, at least one uppercase letter, and at least one number.';

function validPassword(p: string): boolean {
  return p.length >= 8 && /[A-Z]/.test(p) && /\d/.test(p);
}

function ResetPasswordInner() {
  const router = useRouter();
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const expireTimer = window.setTimeout(() => {
      if (!cancelled) setTimedOut(true);
    }, 8000);

    const trySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (session && (hash.includes('type=recovery') || hash.includes('access_token'))) {
        setRecoveryReady(true);
        window.clearTimeout(expireTimer);
      }
    };

    void trySession();
    const retry = window.setTimeout(() => void trySession(), 400);

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryReady(true);
        window.clearTimeout(expireTimer);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(expireTimer);
      window.clearTimeout(retry);
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!validPassword(password)) {
      setErrorMsg(PW_RULES);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setErrorMsg('This reset link has expired. Please request a new one.');
      return;
    }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('gv_advertiser_pw_reset_ok', '1');
    }
    router.replace('/advertiser/dashboard');
  };

  if (!recoveryReady && timedOut) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white border rounded-lg p-6 shadow-sm text-center text-sm text-gray-800">
            <p className="text-red-800 font-medium">This reset link has expired. Please request a new one.</p>
            <Link href="/advertiser/login" className="inline-block mt-4 text-amber-900 underline">
              Back to sign in
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!recoveryReady) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
          <p className="text-sm text-gray-600">Verifying your reset link…</p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-stone-50">
        <div className="max-w-md mx-auto px-4 py-14">
          <h1 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            Set a new password
          </h1>
          <p className="text-xs text-gray-600 mb-6">{PW_RULES}</p>
          <form onSubmit={(e) => void submit(e)} className="bg-white border border-stone-200 rounded-lg p-6 space-y-4 shadow-sm">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">New password *</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Confirm password *</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {errorMsg && <p className="text-sm text-red-700">{errorMsg}</p>}
            <button type="submit" disabled={busy} className="w-full py-3 rounded-md bg-[#0f1f3d] text-white font-semibold text-sm disabled:opacity-60">
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function AdvertiserResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">Loading…</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
