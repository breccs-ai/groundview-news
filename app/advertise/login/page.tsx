'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { hasAdvertiserRole } from '@/lib/profile-roles';

export default function AdvertiserLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [fullNameForUpsell, setFullNameForUpsell] = useState('');
  const [showAdvertiserUpsell, setShowAdvertiserUpsell] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    setShowAdvertiserUpsell(false);

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });

    if (error) {
      setErrorMsg('Incorrect email or password. Please try again.');
      setStatus('error');
      return;
    }

    const user = authData.user;
    if (!user?.id) {
      setErrorMsg('Could not verify your session. Please try again.');
      setStatus('error');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, roles, full_name')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      setErrorMsg('Could not load your profile. Please try again.');
      setStatus('error');
      return;
    }

    const row =
      profileError?.code === 'PGRST116'
        ? null
        : (profile as { role?: string | null; roles?: string[] | null; full_name?: string | null } | null);

    const hasRole = hasAdvertiserRole(row);
    if (hasRole) {
      router.replace('/advertise/dashboard');
      return;
    }

    setSessionUserId(user.id);
    setFullNameForUpsell(row?.full_name?.trim() || '');
    setShowAdvertiserUpsell(true);
    setStatus('idle');
  };

  const addAdvertiserRole = async () => {
    if (!sessionUserId) return;
    setStatus('loading');
    setErrorMsg('');
    const res = await fetch('/api/advertiser/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: sessionUserId,
        email: form.email.trim(),
        full_name: fullNameForUpsell,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrorMsg(typeof body.error === 'string' ? body.error : 'Could not add advertiser access.');
      setStatus('error');
      return;
    }
    router.replace('/advertise/dashboard');
  };

  return (
    <>
      <Navbar />
      <main className="bg-white min-h-screen">
        <div style={{ backgroundColor: '#0f1f3d' }} className="py-14">
          <div className="max-w-lg mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">Advertiser Portal</p>
            <h1 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Sign in
            </h1>
            <p className="mt-3 text-gray-400 text-sm">Access your advertising dashboard.</p>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 sm:px-6 py-14">
          {showAdvertiserUpsell ? (
            <div className="space-y-5">
              <p className="text-sm text-gray-800">
                Your account does not have advertiser access. Would you like to add it?
              </p>
              {status === 'error' && <p className="text-sm text-red-600">{errorMsg}</p>}
              <button
                type="button"
                disabled={status === 'loading'}
                onClick={() => addAdvertiserRole()}
                className="w-full py-3 bg-gray-900 hover:bg-blue-900 text-white font-semibold text-sm rounded-sm transition-colors disabled:opacity-60"
              >
                {status === 'loading' ? 'Adding access…' : 'Add advertiser access'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setShowAdvertiserUpsell(false);
                  setSessionUserId(null);
                }}
                className="w-full py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
              >
                Sign out and use a different account
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Email Address *</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} required
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                  placeholder="jane@company.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Password *</label>
                <input type="password" name="password" value={form.password} onChange={handleChange} required
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                  placeholder="Your password" />
              </div>

              {status === 'error' && <p className="text-sm text-red-600">{errorMsg}</p>}

              <button type="submit" disabled={status === 'loading'}
                className="w-full py-3 bg-gray-900 hover:bg-blue-900 text-white font-semibold text-sm rounded-sm transition-colors disabled:opacity-60">
                {status === 'loading' ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            No account yet?{' '}
            <Link href="/advertise/register" className="text-amber-700 hover:text-amber-900 underline">Create one here</Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
