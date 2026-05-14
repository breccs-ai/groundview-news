'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { loadStripe } from '@stripe/stripe-js';

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

const RESET_REDIRECT = 'https://groundviewnews.com/advertiser/reset-password';

const COUNTRIES = [
  { v: 'United Kingdom', l: 'United Kingdom' },
  { v: 'Ireland', l: 'Ireland' },
  { v: 'France', l: 'France' },
  { v: 'Germany', l: 'Germany' },
  { v: 'Netherlands', l: 'Netherlands' },
  { v: 'Spain', l: 'Spain' },
  { v: 'Italy', l: 'Italy' },
  { v: 'Belgium', l: 'Belgium' },
  { v: 'Other EU / EEA', l: 'Other EU / EEA' },
  { v: 'Other', l: 'Other' },
];

export default function AdvertiserRegisterV2Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">Loading…</div>}>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
  }
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    password: '',
    confirm: '',
    phone: '',
    website: '',
    country: 'United Kingdom',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [kycLoading, setKycLoading] = useState(false);
  const [kycStep2Gate, setKycStep2Gate] = useState<'loading' | 'show'>('loading');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'loading' | 'sent'>('idle');

  useEffect(() => {
    if (searchParams.get('step') === '2') setStep(2);
  }, [searchParams]);

  useEffect(() => {
    if (step !== 2) {
      setKycStep2Gate('loading');
      return;
    }
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user?.id) {
        setKycStep2Gate('show');
        return;
      }
      const { data: row, error } = await supabase
        .from('advertiser_profiles')
        .select('kyc_status, stripe_identity_verified')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !row) {
        setKycStep2Gate('show');
        return;
      }
      const r = row as { kyc_status: string; stripe_identity_verified: boolean };
      if (r.kyc_status === 'verified' && r.stripe_identity_verified === true) {
        router.replace('/advertiser/dashboard');
        return;
      }
      setKycStep2Gate('show');
    })();
    return () => {
      cancelled = true;
    };
  }, [step, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const step1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
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
    const emailTrim = form.email.trim();

    const signUp = await supabase.auth.signUp({ email: emailTrim, password: form.password });
    let uid: string | undefined;
    if (signUp.error) {
      const em = signUp.error.message.toLowerCase();
      if (em.includes('already') || em.includes('registered')) {
        const signedIn = await supabase.auth.signInWithPassword({ email: emailTrim, password: form.password });
        if (signedIn.error || !signedIn.data.session) {
          setErrorMsg(signUp.error.message);
          setStatus('error');
          return;
        }
        uid = signedIn.data.user.id;
      } else {
        setErrorMsg(signUp.error.message);
        setStatus('error');
        return;
      }
    } else {
      uid = signUp.data.user?.id;
    }

    if (!uid) {
      setErrorMsg('Could not create session.');
      setStatus('error');
      return;
    }

    const reg = await fetch('/api/advertiser/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: uid, email: emailTrim, full_name: form.contact_name }),
    });
    const regBody = await reg.json().catch(() => ({}));
    if (!reg.ok) {
      setErrorMsg(typeof regBody.error === 'string' ? regBody.error : 'Profile setup failed.');
      setStatus('error');
      return;
    }

    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setErrorMsg('Session not ready. Confirm your email if required, then sign in and return to this page.');
      setStatus('error');
      return;
    }

    const boot = await fetch('/api/advertiser/bootstrap-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        email: emailTrim,
        phone: form.phone.trim(),
        website: form.website.trim(),
        country: form.country,
      }),
    });
    const bootBody = await boot.json().catch(() => ({}));
    if (!boot.ok) {
      setErrorMsg(typeof bootBody.error === 'string' ? bootBody.error : 'Advertiser profile setup failed.');
      setStatus('error');
      return;
    }

    setStatus('idle');
    if (searchParams.get('redirect') === 'create-ad') {
      window.location.assign('/advertiser/create-ad');
      return;
    }
    setStep(2);
  };

  const startKyc = async () => {
    setKycLoading(true);
    setErrorMsg('');
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setErrorMsg('Not signed in.');
        return;
      }
      const res = await fetch('/api/advertiser/kyc', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(typeof body.error === 'string' ? body.error : 'Could not start verification.');
        return;
      }
      if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
        setErrorMsg('Stripe publishable key is not configured.');
        return;
      }
      const stripe = await stripePromise;
      if (!stripe) {
        setErrorMsg('Could not load Stripe.');
        return;
      }
      const clientSecret = body.client_secret as string;
      const verify = (stripe as unknown as { verifyIdentity: (cs: string) => Promise<{ error?: { message?: string } }> })
        .verifyIdentity;
      if (typeof verify !== 'function') {
        setErrorMsg('Stripe Identity is not available in this browser build. Update @stripe/stripe-js.');
        return;
      }
      const { error } = await verify.call(stripe, clientSecret);
      if (error?.message) {
        setErrorMsg(error.message);
        return;
      }
      window.location.href = '/advertiser/dashboard';
    } finally {
      setKycLoading(false);
    }
  };

  const sendForgotReset = async () => {
    if (!forgotEmail.trim()) return;
    setForgotStatus('loading');
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: RESET_REDIRECT,
    });
    if (error) {
      console.error('[advertiser/register] resetPasswordForEmail', error);
    }
    setForgotStatus('sent');
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-stone-50">
        <div className="max-w-lg mx-auto px-4 py-14">
          <h1
            className="text-3xl font-bold text-gray-900 mb-2"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            Advertiser registration
          </h1>
          <p className="text-sm text-gray-600 mb-8">
            Step {step} of 2 ·{' '}
            <Link href="/legal/advertiser-terms" className="text-amber-800 underline">
              Advertiser terms
            </Link>
          </p>
          {searchParams.get('redirect') === 'create-ad' && step === 1 && (
            <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
              After you sign in or create your account, you&apos;ll return to finish your advertisement.
            </p>
          )}

          {step === 1 ? (
            <form
              onSubmit={(e) => {
                if (showForgotPassword) {
                  e.preventDefault();
                  return;
                }
                void step1Submit(e);
              }}
              className="bg-white border border-stone-200 rounded-lg p-6 space-y-4 shadow-sm"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company name *</label>
                <input name="company_name" required className="w-full border rounded-md px-3 py-2 text-sm" value={form.company_name} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Contact name *</label>
                <input name="contact_name" required className="w-full border rounded-md px-3 py-2 text-sm" value={form.contact_name} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                <input name="email" type="email" required className="w-full border rounded-md px-3 py-2 text-sm" value={form.email} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Password *</label>
                <input name="password" type="password" required className="w-full border rounded-md px-3 py-2 text-sm" value={form.password} onChange={handleChange} />
                {!showForgotPassword ? (
                  <button type="button" className="text-xs text-amber-900 underline mt-1.5" onClick={() => setShowForgotPassword(true)}>
                    Forgot password?
                  </button>
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Confirm password *</label>
                <input name="confirm" type="password" required className="w-full border rounded-md px-3 py-2 text-sm" value={form.confirm} onChange={handleChange} />
              </div>
              {showForgotPassword && (
                <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-xs font-semibold text-gray-800">Reset your password</p>
                    <button type="button" className="text-xs text-gray-600 underline shrink-0" onClick={() => { setShowForgotPassword(false); setForgotStatus('idle'); setForgotEmail(''); }}>
                      Close
                    </button>
                  </div>
                  {forgotStatus === 'sent' ? (
                    <p className="text-xs text-gray-800 leading-relaxed">
                      If an account exists for this email address you will receive a reset link shortly.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Email address *</label>
                        <input
                          type="email"
                          required
                          className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          autoComplete="email"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={forgotStatus === 'loading'}
                        onClick={() => void sendForgotReset()}
                        className="w-full py-2 rounded-md bg-amber-700 text-white font-semibold text-sm disabled:opacity-60"
                      >
                        {forgotStatus === 'loading' ? 'Sending…' : 'Send reset link'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                <input name="phone" className="w-full border rounded-md px-3 py-2 text-sm" value={form.phone} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Website</label>
                <input name="website" className="w-full border rounded-md px-3 py-2 text-sm" value={form.website} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Country *</label>
                <select name="country" className="w-full border rounded-md px-3 py-2 text-sm" value={form.country} onChange={handleChange}>
                  {COUNTRIES.map((c) => (
                    <option key={c.v} value={c.v}>
                      {c.l}
                    </option>
                  ))}
                </select>
              </div>
              {errorMsg && <p className="text-sm text-red-700">{errorMsg}</p>}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-3 rounded-md bg-[#0f1f3d] text-white font-semibold text-sm disabled:opacity-60"
              >
                {status === 'loading' ? 'Creating account…' : 'Continue to identity verification'}
              </button>
            </form>
          ) : kycStep2Gate === 'loading' ? (
            <div className="bg-white border border-stone-200 rounded-lg p-8 shadow-sm text-center text-sm text-gray-600">
              Checking your verification status…
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4 shadow-sm">
              <p className="text-sm text-gray-800 leading-relaxed">
                We are required by UK and EU law to verify your identity before you can place advertisements. A one-time
                verification fee applies. This keeps Ground View News and its advertisers legally protected.
              </p>
              {errorMsg && <p className="text-sm text-red-700">{errorMsg}</p>}
              <button
                type="button"
                onClick={() => void startKyc()}
                disabled={kycLoading}
                className="w-full py-3 rounded-md bg-amber-700 text-white font-semibold text-sm disabled:opacity-60"
              >
                {kycLoading ? 'Opening Stripe…' : 'Start identity verification'}
              </button>
              <Link href="/advertiser/dashboard" className="block text-center text-sm text-amber-900 underline">
                Skip to dashboard (if already verified)
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
