'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { CircleCheck as CheckCircle } from 'lucide-react';

export default function AdvertiserRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setErrorMsg('Passwords do not match.');
      setStatus('error');
      return;
    }
    if (form.password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (error || !data.user) {
      setErrorMsg(error?.message || 'Registration failed. Please try again.');
      setStatus('error');
      return;
    }

    const profileRes = await fetch('/api/advertiser/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: data.user.id,
        email: form.email,
        full_name: form.full_name,
      }),
    });

    const profileBody = await profileRes.json().catch(() => ({}));

    if (!profileRes.ok) {
      setErrorMsg(profileBody.error || 'Account created but profile setup failed. Please contact support@groundviewnews.com.');
      setStatus('error');
      return;
    }

    await fetch('/api/advertiser/welcome-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, full_name: form.full_name }),
    }).catch(() => {});

    router.push('/advertise/dashboard');
  };

  return (
    <>
      <Navbar />
      <main className="bg-white min-h-screen">
        <div style={{ backgroundColor: '#0f1f3d' }} className="py-14">
          <div className="max-w-lg mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">Advertiser Portal</p>
            <h1 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Create an account
            </h1>
            <p className="mt-3 text-gray-400 text-sm">Register to create and manage your ads on Ground View News.</p>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 sm:px-6 py-14">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Full Name *</label>
              <input type="text" name="full_name" value={form.full_name} onChange={handleChange} required
                className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                placeholder="Jane Smith" />
            </div>
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
                placeholder="Minimum 8 characters" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Confirm Password *</label>
              <input type="password" name="confirm" value={form.confirm} onChange={handleChange} required
                className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                placeholder="Re-enter password" />
            </div>

            {status === 'error' && <p className="text-sm text-red-600">{errorMsg}</p>}

            <button type="submit" disabled={status === 'loading'}
              className="w-full py-3 bg-gray-900 hover:bg-blue-900 text-white font-semibold text-sm rounded-sm transition-colors disabled:opacity-60">
              {status === 'loading' ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/advertise/login" className="text-amber-700 hover:text-amber-900 underline">Sign in</Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
