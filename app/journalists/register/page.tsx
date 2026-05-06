'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { CircleCheck as CheckCircle } from 'lucide-react';

const TIERS = [
  { id: 'starter',      label: 'Starter',      price: '£19/month', articles: '4 articles per month',     pence: 1900 },
  { id: 'standard',     label: 'Standard',     price: '£39/month', articles: '12 articles per month',    pence: 3900, popular: true },
  { id: 'professional', label: 'Professional', price: '£69/month', articles: 'Unlimited articles',        pence: 6900 },
];

export default function JournalistRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: '', pen_name: '', email: '', password: '', confirm: '', bio: '', tier: 'standard',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'redirecting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setErrorMsg('Passwords do not match.'); setStatus('error'); return; }
    if (form.password.length < 8) { setErrorMsg('Password must be at least 8 characters.'); setStatus('error'); return; }
    if (!form.tier) { setErrorMsg('Please select a subscription tier.'); setStatus('error'); return; }

    setStatus('loading');
    setErrorMsg('');

    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password });

    if (error || !data.user) {
      setErrorMsg(error?.message || 'Registration failed. Please try again.');
      setStatus('error');
      return;
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      email: form.email,
      full_name: form.full_name,
      pen_name: form.pen_name,
      bio: form.bio,
      role: 'journalist',
      subscription_tier: form.tier,
    });

    if (profileError) {
      setErrorMsg('Account created but profile setup failed. Please contact support@groundviewnews.com.');
      setStatus('error');
      return;
    }

    setStatus('redirecting');

    const checkoutRes = await fetch('/api/journalist/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: form.tier, userId: data.user.id, email: form.email }),
    });

    const { url, error: checkoutError } = await checkoutRes.json();

    if (checkoutError || !url) {
      router.push('/journalists/dashboard');
      return;
    }

    window.location.href = url;
  };

  return (
    <>
      <Navbar />
      <main className="bg-white min-h-screen">
        <div style={{ backgroundColor: '#0f1f3d' }} className="py-14">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">Journalist Portal</p>
            <h1 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Join as a contributor
            </h1>
            <p className="mt-3 text-gray-400 text-sm max-w-xl mx-auto">
              Submit your commentary and analysis to Ground View News. Select a subscription tier, register, and start publishing.
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
          {/* Tier selection */}
          <div className="mb-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Choose your subscription
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {TIERS.map((t) => (
                <button key={t.id} type="button" onClick={() => setForm((prev) => ({ ...prev, tier: t.id }))}
                  className={`relative p-5 border rounded-sm text-left transition-all ${
                    form.tier === t.id
                      ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400'
                      : 'border-gray-200 bg-white hover:border-gray-400'
                  }`}>
                  {t.popular && (
                    <span className="absolute -top-2.5 left-3 text-xs font-semibold uppercase tracking-widest bg-amber-500 text-white px-2 py-0.5 rounded-sm">Popular</span>
                  )}
                  <p className="font-bold text-gray-900 text-sm">{t.label}</p>
                  <p className="text-xl font-bold mt-1" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{t.price}</p>
                  <p className="text-xs text-gray-500 mt-1">{t.articles}</p>
                  {form.tier === t.id && <CheckCircle size={15} className="absolute top-3 right-3 text-amber-600" />}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Full Name *</label>
                <input type="text" name="full_name" value={form.full_name} onChange={handleChange} required
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                  placeholder="Jane Smith" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Pen Name *</label>
                <input type="text" name="pen_name" value={form.pen_name} onChange={handleChange} required
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                  placeholder="Name as it will appear on articles" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Email Address *</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required
                className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                placeholder="jane@example.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Short Bio *</label>
              <textarea name="bio" value={form.bio} onChange={handleChange} required rows={3}
                className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors resize-none"
                placeholder="A brief description of your background and areas of expertise" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
            </div>

            {status === 'error' && <p className="text-sm text-red-600">{errorMsg}</p>}

            <button type="submit" disabled={status === 'loading' || status === 'redirecting'}
              className="w-full py-3 bg-gray-900 hover:bg-blue-900 text-white font-semibold text-sm rounded-sm transition-colors disabled:opacity-60">
              {status === 'loading' ? 'Creating account…' : status === 'redirecting' ? 'Redirecting to payment…' : 'Register and Pay'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/journalists/login" className="text-amber-700 hover:text-amber-900 underline">Sign in</Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
