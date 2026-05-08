'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { CATEGORIES } from '@/lib/supabase';
import { bodyTextToJson } from '@/lib/admin-auth';
import { CircleCheck as CheckCircle } from 'lucide-react';

const LABEL_OPTIONS = ['Analysis', 'Opinion', 'Commentary', 'Investigation', 'Report', 'Interview'];

type Form = {
  title: string;
  subtitle: string;
  pen_name: string;
  category: string;
  label: string;
  excerpt: string;
  bodyText: string;
};

const EMPTY: Form = {
  title: '', subtitle: '', pen_name: '', category: '', label: '', excerpt: '', bodyText: '',
};

export default function JournalistSubmitPage() {
  const router = useRouter();
  const [form, setForm] = useState<Form>(EMPTY);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [resultMsg, setResultMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/journalists/login'); return; }
      setUserId(session.user.id);
      setUserEmail(session.user.email || '');

      const { data: profile } = await supabase.from('profiles').select('pen_name').eq('id', session.user.id).maybeSingle();
      if (profile?.pen_name) {
        setForm((prev) => ({ ...prev, pen_name: profile.pen_name }));
      }
    })();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.category || !form.bodyText) {
      setErrorMsg('Title, category, and article body are required.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg('');
    setResultMsg('');

    const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

    const body = bodyTextToJson(form.bodyText);

    const { data, error } = await supabase.from('articles').insert({
      title: form.title,
      subtitle: form.subtitle,
      author_name: form.pen_name,
      category: form.category,
      label: form.label,
      excerpt: form.excerpt,
      body,
      status: 'pending',
      slug,
    }).select('id').maybeSingle();

    if (error) {
      setErrorMsg('Submission failed. Please try again.');
      setStatus('error');
      return;
    }

    const articleId = (data as { id?: string } | null)?.id;
    if (!articleId) {
      setErrorMsg('Article saved but could not start automated review. Please contact support.');
      setStatus('error');
      return;
    }

    const reviewRes = await fetch('/api/articles/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_id: articleId }),
    });
    const reviewBody = await reviewRes.json().catch(() => ({}));

    if (!reviewRes.ok) {
      setErrorMsg(reviewBody.error || 'Automated review failed. Your article is still saved and will be reviewed by editors.');
      setStatus('error');
      return;
    }

    if (reviewBody.outcome === 'published') {
      setResultMsg(`Your article has been published at groundviewnews.com/article/${slug}`);
    } else if (reviewBody.outcome === 'pending') {
      setResultMsg('Your article is under editorial review. You will hear back within 24 hours.');
    } else {
      const reason = reviewBody.reason ? `Reason: ${reviewBody.reason}` : '';
      const notes = reviewBody.notes ? `Editorial notes: ${reviewBody.notes}` : '';
      setResultMsg(`Your article was not accepted. ${reason} ${notes}`.trim());
    }

    setStatus('success');
  };

  if (status === 'success') {
    return (
      <>
        <Navbar />
        <main className="bg-white min-h-screen">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
            <div className="flex justify-center mb-6">
              <CheckCircle size={48} className="text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Article submitted
            </h1>
            <p className="text-gray-600 mb-6">
              {resultMsg || 'Your article has been submitted for editorial review. You will hear back within 24 hours.'}
            </p>
            <button onClick={() => router.push('/journalists/dashboard')}
              className="inline-flex items-center px-6 py-3 text-sm font-semibold text-white rounded-sm transition-colors"
              style={{ backgroundColor: '#0f1f3d' }}>
              Back to dashboard
            </button>
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
        <div style={{ backgroundColor: '#0f1f3d' }} className="py-10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2">Journalist Portal</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Submit an Article
            </h1>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Title *</label>
              <input type="text" name="title" value={form.title} onChange={handleChange} required
                className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                placeholder="Article headline" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Subtitle / Standfirst</label>
              <input type="text" name="subtitle" value={form.subtitle} onChange={handleChange}
                className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                placeholder="One-sentence opening hook" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Pen Name *</label>
                <input type="text" name="pen_name" value={form.pen_name} onChange={handleChange} required
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                  placeholder="Name as it appears" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Category *</label>
                <select name="category" value={form.category} onChange={handleChange} required
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors bg-white">
                  <option value="">Select</option>
                  {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Label</label>
                <select name="label" value={form.label} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors bg-white">
                  <option value="">None</option>
                  {LABEL_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Excerpt</label>
              <textarea name="excerpt" value={form.excerpt} onChange={handleChange} rows={2}
                className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors resize-none"
                placeholder="1-2 sentence summary for search engines and article cards" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                Article Body * <span className="normal-case font-normal text-gray-400">(separate paragraphs with a blank line)</span>
              </label>
              <div className="mb-3 rounded-sm border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p className="font-semibold mb-1">Formatting guide:</p>
                <ul className="space-y-0.5">
                  <li>- Separate paragraphs with a blank line</li>
                  <li>- Start a line with ## for a subheading (H2)</li>
                  <li>- Start a line with ### for a smaller subheading (H3)</li>
                  <li>- Start a line with &gt; for a pull quote</li>
                  <li>- Start a line with --- for a section divider</li>
                  <li>- Start a line with - for a bullet point</li>
                </ul>
              </div>
              <textarea name="bodyText" value={form.bodyText} onChange={handleChange} required rows={20}
                className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors resize-y"
                placeholder={'Write your article here.\n\n## Subheading\n\n> Pull quote\n\n---\n\n- Bullet one\n- Bullet two'} />
            </div>

            {status === 'error' && <p className="text-sm text-red-600">{errorMsg}</p>}

            <button type="submit" disabled={status === 'loading'}
              className="w-full py-3 font-semibold text-sm rounded-sm transition-colors text-white disabled:opacity-60"
              style={{ backgroundColor: '#0f1f3d' }}>
              {status === 'loading' ? 'Submitting…' : 'Submit for Review'}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
