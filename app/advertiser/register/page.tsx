'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';

const RESET_REDIRECT = 'https://groundviewnews.com/advertiser/reset-password';
const KYC_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const KYC_MAX_BYTES = 10 * 1024 * 1024;

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
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [kycPreviewUrl, setKycPreviewUrl] = useState<string | null>(null);
  const [kycUploadSuccess, setKycUploadSuccess] = useState(false);
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
        .select('kyc_status')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !row) {
        setKycStep2Gate('show');
        return;
      }
      const r = row as { kyc_status: string };
      if (r.kyc_status === 'verified') {
        router.replace('/advertiser/dashboard');
        return;
      }
      if (r.kyc_status === 'pending_review') {
        setKycUploadSuccess(true);
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

  useEffect(() => {
    if (!kycFile || !kycFile.type.startsWith('image/')) {
      setKycPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(kycFile);
    setKycPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [kycFile]);

  const onKycFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) {
      setKycFile(null);
      return;
    }
    if (!KYC_ACCEPT.split(',').includes(file.type)) {
      setErrorMsg('Please upload a JPEG, PNG, WebP, or PDF file.');
      setKycFile(null);
      e.target.value = '';
      return;
    }
    if (file.size > KYC_MAX_BYTES) {
      setErrorMsg('File exceeds 10MB limit.');
      setKycFile(null);
      e.target.value = '';
      return;
    }
    setKycFile(file);
  };

  const submitKycDocument = async () => {
    if (!kycFile) {
      setErrorMsg('Please select a document to upload.');
      return;
    }
    setKycLoading(true);
    setErrorMsg('');
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setErrorMsg('Not signed in.');
        return;
      }
      const formData = new FormData();
      formData.append('file', kycFile);
      const res = await fetch('/api/advertiser/kyc-upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(typeof body.error === 'string' ? body.error : 'Upload failed. Please try again.');
        return;
      }
      setKycUploadSuccess(true);
      setKycFile(null);
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
          ) : kycUploadSuccess ? (
            <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4 shadow-sm">
              <p className="text-sm text-gray-800 leading-relaxed">
                Your document has been submitted successfully. We will review it within 1-2 business days and notify you
                by email. You can access your dashboard while you wait.
              </p>
              <Link
                href="/advertiser/dashboard"
                className="block w-full py-3 rounded-md bg-[#0f1f3d] text-white font-semibold text-sm text-center"
              >
                Go to dashboard
              </Link>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-5 shadow-sm">
              <div>
                <h2
                  className="text-xl font-bold text-gray-900 mb-1"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                >
                  Verify your identity
                </h2>
                <p className="text-sm text-gray-700 leading-relaxed">
                  To comply with UK and EU regulations, we need to verify your identity before you can place
                  advertisements. Please upload a clear photo or scan of one of the following:
                </p>
              </div>

              <ul className="text-sm text-gray-800 list-disc pl-5 space-y-1">
                <li>Passport (any country)</li>
                <li>Driving licence (any country)</li>
                <li>National ID card (any country)</li>
              </ul>

              <p className="text-xs text-gray-600 leading-relaxed">
                We are required by UK and EU law to verify your identity before you can place advertisements on Ground
                View News. Please upload a government-issued photo ID. Your document is stored securely and reviewed only
                by Ground View News staff for the purpose of identity verification. It is never shared with third parties.
                By submitting your document you confirm you have read and agree to our{' '}
                <Link href="/legal/advertiser-terms" className="text-amber-900 underline">
                  Advertiser Terms
                </Link>{' '}
                and{' '}
                <Link href="/privacy-policy" className="text-amber-900 underline">
                  Privacy Policy
                </Link>
                .
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Identity document *</label>
                <input
                  type="file"
                  accept={KYC_ACCEPT}
                  onChange={onKycFileChange}
                  className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-900"
                />
                {kycFile && (
                  <p className="mt-2 text-xs text-gray-600">
                    Selected: <span className="font-medium text-gray-900">{kycFile.name}</span>
                  </p>
                )}
                {kycPreviewUrl && (
                  <img
                    src={kycPreviewUrl}
                    alt="Document preview"
                    className="mt-3 max-h-48 rounded-md border border-stone-200 object-contain"
                  />
                )}
              </div>

              <div className="rounded-md border border-amber-100 bg-amber-50/60 px-3 py-3 text-xs text-gray-700 leading-relaxed">
                <p className="font-semibold text-gray-900 mb-1">Please ensure your document is:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Clear and fully visible with no cut-off edges</li>
                  <li>Not expired</li>
                  <li>Showing your full name and date of birth</li>
                </ul>
              </div>

              {errorMsg && <p className="text-sm text-red-700">{errorMsg}</p>}

              <button
                type="button"
                onClick={() => void submitKycDocument()}
                disabled={kycLoading || !kycFile}
                className="w-full py-3 rounded-md bg-amber-700 text-white font-semibold text-sm disabled:opacity-60"
              >
                {kycLoading ? 'Uploading your document…' : 'Submit document for review'}
              </button>

              <Link href="/advertiser/dashboard" className="block text-center text-sm text-amber-900 underline">
                Go to dashboard
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
