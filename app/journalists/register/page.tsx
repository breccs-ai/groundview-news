'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';

const EXPERTISE_OPTIONS = [
  'World Politics',
  'Human Rights',
  'Economy',
  'Business',
  'Science',
  'Culture',
  'Commentary',
] as const;

type ExpertiseOption = (typeof EXPERTISE_OPTIONS)[number];

function JournalistRegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    full_name: '',
    pen_name: '',
    email: '',
    password: '',
    confirm: '',
    bio: '',
    expertise: [] as ExpertiseOption[],
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [successDetail, setSuccessDetail] = useState<{ existing: boolean; message: string } | null>(null);

  useEffect(() => {
    const h = searchParams.get('emailHint')?.trim();
    if (!h) return;
    setForm((p) => (p.email ? p : { ...p, email: h }));
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleExpertiseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value as ExpertiseOption);
    setForm((prev) => ({ ...prev, expertise: selected }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setErrorMsg('Passwords do not match.'); setStatus('error'); return; }
    if (form.password.length < 8) { setErrorMsg('Password must be at least 8 characters.'); setStatus('error'); return; }
    if (form.expertise.length === 0) { setErrorMsg('Please select at least one area of expertise.'); setStatus('error'); return; }

    setStatus('loading');
    setErrorMsg('');

    const emailTrim = form.email.trim();
    const password = form.password;

    const signUp = await supabase.auth.signUp({ email: emailTrim, password });

    let uid: string | undefined;

    if (signUp.error) {
      const em = signUp.error.message.toLowerCase();
      const duplicate =
        em.includes('registered') ||
        em.includes('already') ||
        em.includes('exists') ||
        em.includes('user already');
      if (duplicate) {
        const signedIn = await supabase.auth.signInWithPassword({
          email: emailTrim,
          password,
        });
        if (signedIn.error || !signedIn.data.user) {
          setErrorMsg(
            'An account with this email already exists. Sign in with your password first, then add contributor access from your dashboard.',
          );
          setStatus('error');
          return;
        }
        uid = signedIn.data.user.id;
      } else {
        setErrorMsg(signUp.error.message || 'Registration failed. Please try again.');
        setStatus('error');
        return;
      }
    } else {
      uid = signUp.data.user?.id;
    }

    if (!uid) {
      setErrorMsg('Registration failed. Please try again.');
      setStatus('error');
      return;
    }

    const profileRes = await fetch('/api/journalist/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: uid,
        email: emailTrim,
        full_name: form.full_name,
        pen_name: form.pen_name,
        bio: form.bio,
        expertise: form.expertise,
      }),
    });

    const profileBody = await profileRes.json().catch(() => ({}));

    if (!profileRes.ok) {
      setErrorMsg(
        typeof profileBody.error === 'string'
          ? profileBody.error
          : 'Application could not be saved. Please contact support@groundviewnews.com.',
      );
      setStatus('error');
      return;
    }

    setSuccessDetail({
      existing: Boolean(profileBody.existing),
      message: typeof profileBody.message === 'string' ? profileBody.message : '',
    });
    setStatus('success');
    window.setTimeout(() => router.replace('/dashboard'), profileBody.existing ? 2200 : 1200);
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
              Apply to become a Ground View News contributor. Our editorial team reviews all journalist profiles before publishing access is granted.
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
          {status === 'success' ? (
            <div className="bg-green-50 border border-green-200 rounded-sm p-6">
              <p className="text-sm font-semibold text-green-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                {successDetail?.existing && successDetail.message
                  ? successDetail.message
                  : 'Your application has been received.'}
              </p>
              <p className="text-sm text-green-800 mt-2">
                {successDetail?.existing
                  ? 'We notified our editorial desk. Redirecting…'
                  : 'Our editorial team will review your profile and you will receive an email within 48 hours.'}
              </p>
              <div className="mt-5 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="px-4 py-2.5 bg-gray-900 hover:bg-blue-900 text-white font-semibold text-sm rounded-sm transition-colors"
                >
                  Open dashboard
                </button>
                <Link href="/" className="text-sm text-amber-700 hover:text-amber-900 underline">
                  Back to homepage
                </Link>
              </div>
            </div>
          ) : (
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
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Areas of Expertise *</label>
              <select
                multiple
                value={form.expertise}
                onChange={handleExpertiseChange}
                required
                className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
              >
                {EXPERTISE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1.5">Hold Ctrl (Windows) / Cmd (Mac) to select multiple.</p>
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

            <button type="submit" disabled={status === 'loading'}
              className="w-full py-3 bg-gray-900 hover:bg-blue-900 text-white font-semibold text-sm rounded-sm transition-colors disabled:opacity-60">
              {status === 'loading' ? 'Submitting application…' : 'Submit application'}
            </button>
            </form>
          )}

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

export default function JournalistRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <JournalistRegisterInner />
    </Suspense>
  );
}
