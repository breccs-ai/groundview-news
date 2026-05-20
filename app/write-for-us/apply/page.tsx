'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { COUNTRIES } from '@/lib/countries';

const NAVY = '#0f1f3d';

// Must remain identical to COVERAGE_AREAS on app/write-for-us/page.tsx so the landing tiles
// and the application checkboxes always match.
const CATEGORY_OPTIONS = [
  'World Politics',
  'Business & Economy',
  'Financial News & Banking',
  'Sports',
  'Africa & Diaspora',
  'Science & Technology',
  'Culture & Society',
  'Human Interest',
  'Environment & Climate',
  'Health & Medicine',
  'Law & Justice',
  'Education',
  'Travel & Migration',
  'Opinion & Commentary',
  'Other',
] as const;

type CategoryOption = (typeof CATEGORY_OPTIONS)[number];

const HEAR_ABOUT_OPTIONS = [
  'Social media',
  'Search engine',
  'Friend or colleague',
  'Other publication',
  'Other',
] as const;

const BIO_MAX = 300;

type FormState = {
  full_name: string;
  pen_name: string;
  email: string;
  password: string;
  phone_dial: string;
  phone_number: string;
  country: string;
  bio: string;
  categories: CategoryOption[];
  how_heard_about: string;
};

const DEFAULT_DIAL = '44'; // United Kingdom default; updates when user picks country

export default function WriterApplyPage() {
  const [form, setForm] = useState<FormState>({
    full_name: '',
    pen_name: '',
    email: '',
    password: '',
    phone_dial: DEFAULT_DIAL,
    phone_number: '',
    country: 'GB',
    bio: '',
    categories: [],
    how_heard_about: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const bioCount = form.bio.length;

  const sortedCountries = useMemo(
    () => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleCategory = (category: CategoryOption) => {
    setForm((prev) => {
      const selected = prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category];
      return { ...prev, categories: selected };
    });
  };

  const handleCountryChange = (countryCode: string) => {
    const match = COUNTRIES.find((c) => c.code === countryCode);
    setForm((prev) => ({
      ...prev,
      country: countryCode,
      phone_dial: match?.dial ?? prev.phone_dial,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (form.password.length < 8) {
      setErrorMsg('Password must be at least 8 characters so you can log in once approved.');
      setStatus('error');
      return;
    }
    if (form.bio.length > BIO_MAX) {
      setErrorMsg(`Bio must be ${BIO_MAX} characters or less.`);
      setStatus('error');
      return;
    }
    if (form.categories.length === 0) {
      setErrorMsg('Please choose at least one writing category.');
      setStatus('error');
      return;
    }
    if (!form.phone_number.trim()) {
      setErrorMsg('Please enter a phone number.');
      setStatus('error');
      return;
    }

    setStatus('loading');

    const country = COUNTRIES.find((c) => c.code === form.country);
    const phone = `+${form.phone_dial} ${form.phone_number.trim()}`;

    const res = await fetch('/api/writer/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: form.full_name.trim(),
        pen_name: form.pen_name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone,
        country: country?.name ?? form.country,
        bio: form.bio.trim(),
        categories: form.categories,
        how_heard_about: form.how_heard_about || null,
      }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setErrorMsg(typeof body.error === 'string' ? body.error : 'Application could not be submitted.');
      setStatus('error');
      return;
    }

    setStatus('success');
  };

  if (status === 'success') {
    return (
      <>
        <Navbar />
        <main className="bg-white min-h-screen">
          <div style={{ backgroundColor: NAVY }} className="py-14">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400 mb-3">
                Writers Programme
              </p>
              <h1
                className="text-3xl md:text-4xl font-bold text-white"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                Application received
              </h1>
            </div>
          </div>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
            <div className="bg-green-50 border border-green-200 rounded-sm p-6">
              <p
                className="text-base font-semibold text-green-900"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                Application received. Check your email for confirmation. We will be in touch within
                24 hours.
              </p>
              <p className="text-sm text-green-800 mt-3">
                Once approved, sign in at{' '}
                <Link href="/journalists/login" className="underline font-semibold">
                  /journalists/login
                </Link>{' '}
                with the email and password you provided.
              </p>
              <div className="mt-5">
                <Link
                  href="/"
                  className="inline-flex items-center px-4 py-2.5 bg-gray-900 hover:bg-blue-900 text-white font-semibold text-sm rounded-sm transition-colors"
                >
                  Back to homepage
                </Link>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="bg-white min-h-screen">
        <div style={{ backgroundColor: NAVY }} className="py-14">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400 mb-3">
              Writers Programme
            </p>
            <h1
              className="text-3xl md:text-4xl font-bold text-white"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Apply to Write
            </h1>
            <p className="mt-3 text-gray-400 text-sm max-w-xl mx-auto">
              Tell us a little about yourself. We will review every application within 24 hours.
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Full Name *">
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setField('full_name', e.target.value)}
                  className={inputClass}
                  placeholder="Jane Smith"
                />
              </Field>
              <Field label="Pen Name *" hint="This name will appear on every article you publish. It can be your real name or a pen name.">
                <input
                  type="text"
                  required
                  value={form.pen_name}
                  onChange={(e) => setField('pen_name', e.target.value)}
                  className={inputClass}
                  placeholder="J. Smith"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Email Address *">
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  className={inputClass}
                  placeholder="jane@example.com"
                />
              </Field>
              <Field
                label="Password *"
                hint="You will use this to log in once approved. Minimum 8 characters."
              >
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  className={inputClass}
                  placeholder="At least 8 characters"
                />
              </Field>
            </div>

            <Field label="Country / Region *">
              <select
                required
                value={form.country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className={inputClass}
              >
                {sortedCountries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Phone Number *">
              <div className="flex gap-2">
                <select
                  value={form.phone_dial}
                  onChange={(e) => setField('phone_dial', e.target.value)}
                  className={`${inputClass} w-32 shrink-0`}
                  aria-label="Country dial code"
                >
                  {sortedCountries.map((c) => (
                    <option key={`${c.code}-${c.dial}`} value={c.dial}>
                      {c.code} +{c.dial}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="tel"
                  required
                  value={form.phone_number}
                  onChange={(e) => setField('phone_number', e.target.value)}
                  className={`${inputClass} flex-1`}
                  placeholder="20 7946 0958"
                />
              </div>
            </Field>

            <Field
              label="Short Bio *"
              hint={`A brief description of your background. ${bioCount} / ${BIO_MAX} characters.`}
            >
              <textarea
                required
                value={form.bio}
                onChange={(e) => setField('bio', e.target.value.slice(0, BIO_MAX))}
                rows={4}
                maxLength={BIO_MAX}
                className={`${inputClass} resize-none`}
                placeholder="Tell us about your writing background and interests."
              />
            </Field>

            <Field label="Writing Categories *" hint="Select all that apply.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CATEGORY_OPTIONS.map((category) => {
                  const selected = form.categories.includes(category);
                  return (
                    <label
                      key={category}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-sm cursor-pointer transition-colors text-sm ${
                        selected
                          ? 'border-blue-800 bg-blue-50 text-blue-900'
                          : 'border-gray-200 hover:border-gray-400 text-gray-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCategory(category)}
                        className="accent-blue-800"
                      />
                      <span>{category}</span>
                    </label>
                  );
                })}
              </div>
            </Field>

            <Field label="How did you hear about us?" hint="Optional">
              <select
                value={form.how_heard_about}
                onChange={(e) => setField('how_heard_about', e.target.value)}
                className={inputClass}
              >
                <option value="">Prefer not to say</option>
                {HEAR_ABOUT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </Field>

            {status === 'error' && errorMsg && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-3 bg-gray-900 hover:bg-blue-900 text-white font-semibold text-sm rounded-sm transition-colors disabled:opacity-60"
            >
              {status === 'loading' ? 'Submitting application…' : 'Submit application'}
            </button>

            <p className="text-center text-sm text-gray-500">
              Already approved?{' '}
              <Link href="/journalists/login" className="text-amber-700 hover:text-amber-900 underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}

const inputClass =
  'w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors bg-white';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1.5">{hint}</p>}
    </div>
  );
}
