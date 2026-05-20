'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { hasJournalistRole } from '@/lib/profile-roles';
import { Star } from 'lucide-react';

const NAVY = '#0f1f3d';

export default function WriterFeedbackPage() {
  const router = useRouter();
  const [boot, setBoot] = useState<'loading' | 'ready' | 'blocked'>('loading');
  const [form, setForm] = useState({ subject: '', message: '', rating: 0 });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        router.push('/journalists/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('roles, role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (!hasJournalistRole(profile as { roles?: string[] | null; role?: string | null } | null)) {
        setBoot('blocked');
        return;
      }
      setBoot('ready');
    })();
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.subject.trim()) {
      setErrorMsg('Please add a subject.');
      setStatus('error');
      return;
    }
    if (!form.message.trim()) {
      setErrorMsg('Please add a message.');
      setStatus('error');
      return;
    }
    if (form.rating < 1 || form.rating > 5) {
      setErrorMsg('Please choose a rating from 1 to 5 stars.');
      setStatus('error');
      return;
    }

    setStatus('sending');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      router.push('/journalists/login');
      return;
    }

    const res = await fetch('/api/journalist/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subject: form.subject.trim(),
        message: form.message.trim(),
        rating: form.rating,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErrorMsg(typeof body.error === 'string' ? body.error : 'Could not send feedback.');
      setStatus('error');
      return;
    }
    setStatus('success');
    setForm({ subject: '', message: '', rating: 0 });
  };

  if (boot === 'loading') {
    return (
      <>
        <Navbar />
        <main className="bg-white min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </main>
        <Footer />
      </>
    );
  }

  if (boot === 'blocked') {
    return (
      <>
        <Navbar />
        <main className="bg-white min-h-screen">
          <div style={{ backgroundColor: NAVY }} className="py-12">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
              <h1
                className="text-3xl font-bold text-white"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                Writer access required
              </h1>
            </div>
          </div>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
            <p className="text-sm text-gray-700">
              You need a writer account to leave feedback.{' '}
              <Link href="/write-for-us" className="text-amber-700 hover:text-amber-900 underline">
                Apply to write for us
              </Link>
              .
            </p>
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
        <div style={{ backgroundColor: NAVY }} className="py-12">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400 mb-3">
              Writers Programme
            </p>
            <h1
              className="text-3xl md:text-4xl font-bold text-white"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Share your feedback
            </h1>
            <p className="mt-3 text-gray-400 text-sm">
              Tell us how your experience as a Ground View News writer is going.
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
          {status === 'success' ? (
            <div className="bg-green-50 border border-green-200 rounded-sm p-6">
              <p
                className="text-sm font-semibold text-green-900"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                Thank you for your feedback.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="px-4 py-2.5 text-sm font-semibold border border-gray-300 rounded-sm text-gray-800 hover:bg-gray-50"
                >
                  Submit another
                </button>
                <Link
                  href="/journalists/dashboard"
                  className="px-4 py-2.5 bg-gray-900 hover:bg-blue-900 text-white font-semibold text-sm rounded-sm transition-colors"
                >
                  Back to dashboard
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                  placeholder="What is this feedback about?"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Message *
                </label>
                <textarea
                  required
                  rows={6}
                  value={form.message}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors resize-none"
                  placeholder="Share your thoughts."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  How is your experience so far? *
                </label>
                <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active = form.rating >= n;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={form.rating === n}
                        onClick={() => setForm((p) => ({ ...p, rating: n }))}
                        className="p-1.5 rounded-sm hover:bg-amber-50 transition-colors"
                      >
                        <Star
                          size={26}
                          className={active ? 'text-amber-500' : 'text-gray-300'}
                          fill={active ? '#f59e0b' : 'none'}
                        />
                      </button>
                    );
                  })}
                  <span className="ml-2 text-sm text-gray-600">
                    {form.rating ? `${form.rating} / 5` : 'Choose 1–5'}
                  </span>
                </div>
              </div>

              {status === 'error' && errorMsg && (
                <p className="text-sm text-red-600">{errorMsg}</p>
              )}

              <div className="flex gap-3 flex-wrap">
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="px-5 py-2.5 bg-gray-900 hover:bg-blue-900 text-white font-semibold text-sm rounded-sm transition-colors disabled:opacity-60"
                >
                  {status === 'sending' ? 'Sending…' : 'Send feedback'}
                </button>
                <Link
                  href="/journalists/dashboard"
                  className="px-5 py-2.5 text-sm font-semibold border border-gray-300 rounded-sm text-gray-800 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
