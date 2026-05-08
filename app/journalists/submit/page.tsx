'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CategoryBadge from '@/components/CategoryBadge';
import ArticleBodyRenderer from '@/components/ArticleBodyRenderer';
import { supabase } from '@/lib/supabase';
import { CATEGORIES } from '@/lib/supabase';
import {
  markdownBodyPayload,
  storedBodyToEditorMarkdown,
  wordCountMarkdownExcludingSyntax,
} from '@/lib/article-markdown';
import { X, Eye, Save } from 'lucide-react';

const LABEL_OPTIONS = ['Commentary', 'Opinion', 'In Depth', 'Analysis', 'Editorial'];

const GOLD = '#D4AF37';
const NAVY = '#0f1f3d';

type FormState = {
  title: string;
  subtitle: string;
  pen_name: string;
  category: string;
  label: string;
  excerpt: string;
  featured_image_url: string;
  bodyText: string;
};

const EMPTY_FORM: FormState = {
  title: '',
  subtitle: '',
  pen_name: '',
  category: '',
  label: '',
  excerpt: '',
  featured_image_url: '',
  bodyText: '',
};

function JournalistSubmitInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [loadingBoot, setLoadingBoot] = useState(true);
  const [loadingDraftSave, setLoadingDraftSave] = useState(false);
  const [loadingPublish, setLoadingPublish] = useState(false);

  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [bootError, setBootError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [bodyUiMode, setBodyUiMode] = useState<'write' | 'preview'>('write');

  type PublishOutcome =
    | { kind: 'idle' }
    | { kind: 'published'; slug: string }
    | { kind: 'review' }
    | { kind: 'rejected'; reason: string; notes: string };

  const [publishOutcome, setPublishOutcome] = useState<PublishOutcome>({ kind: 'idle' });

  const editingId = searchParams.get('id');
  const isEditing = Boolean(editingId);

  const jsonAuthHeaders = (token: string): Record<string, string> => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  const previewWordCount = useMemo(
    () => wordCountMarkdownExcludingSyntax(form.bodyText),
    [form.bodyText]
  );

  const readMinutes = useMemo(() => Math.max(1, Math.ceil(previewWordCount / 200)), [previewWordCount]);

  useEffect(() => {
    document.body.style.overflow = previewOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [previewOpen]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        router.push('/journalists/login');
        return;
      }
      setUserId(session.user.id);
      setAccessToken(session.access_token);

      const { data: profile } = await supabase.from('profiles').select('pen_name').eq('id', session.user.id).maybeSingle();
      const pn = profile?.pen_name?.trim();

      const loadDraft = async (draftId: string) => {
        const res = await fetch(`/api/articles?id=${encodeURIComponent(draftId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setBootError(json.error || 'Could not load draft.');
          setLoadingBoot(false);
          return;
        }
        const article = json.article as {
          title?: string;
          subtitle?: string;
          category?: string;
          label?: string;
          excerpt?: string;
          featured_image_url?: string;
          body?: unknown;
          author_name?: string;
          id?: string;
        };
        setArticleId(article.id || draftId);
        setForm({
          title: article.title || '',
          subtitle: article.subtitle || '',
          pen_name: article.author_name || pn || '',
          category: article.category || '',
          label: article.label || '',
          excerpt: article.excerpt || '',
          featured_image_url: article.featured_image_url || '',
          bodyText: storedBodyToEditorMarkdown(article.body),
        });
        setLoadingBoot(false);
      };

      const qId = editingId?.trim();

      setForm((prev) => ({
        ...prev,
        pen_name: prev.pen_name || pn || '',
      }));

      if (qId) {
        await loadDraft(qId);
        return;
      }

      setLoadingBoot(false);
    })();
  }, [router, editingId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let v = value;
    if (name === 'excerpt' && value.length > 200) {
      v = value.slice(0, 200);
    }
    setForm((prev) => ({ ...prev, [name]: v }));
    setDraftSavedAt(null);
    setPublishOutcome({ kind: 'idle' });
  };

  const buildPayload = useCallback(() => {
    return {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      author_name: form.pen_name.trim(),
      category: form.category,
      label: form.label,
      excerpt: form.excerpt.trim(),
      featured_image_url: form.featured_image_url.trim(),
      body: markdownBodyPayload(form.bodyText),
      author_id: userId!,
    };
  }, [
    form.bodyText,
    form.title,
    form.subtitle,
    form.pen_name,
    form.category,
    form.label,
    form.excerpt,
    form.featured_image_url,
    userId,
  ]);

  const saveDraft = async () => {
    if (!accessToken || !userId) return;
    setLoadingDraftSave(true);
    try {
      const payload = buildPayload();
      /** Route handler uses SUPABASE_SERVICE_ROLE_KEY for DB writes — the key stays server-side only. */
      const headers = jsonAuthHeaders(accessToken);

      let id = articleId;

      if (id) {
        const res = await fetch('/api/articles', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ id, ...payload, status: 'draft' }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setBootError(json.error || 'Could not save draft.');
          setLoadingDraftSave(false);
          return;
        }
      } else {
        const res = await fetch('/api/articles', {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...payload, status: 'draft' }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setBootError(json.error || 'Could not save draft.');
          setLoadingDraftSave(false);
          return;
        }
        id = json.id || null;
        if (id) setArticleId(id);
        if (id) router.replace(`/journalists/submit?id=${encodeURIComponent(id)}`, { scroll: false });
      }

      setDraftSavedAt(new Date().toISOString());
      setBootError('');
    } finally {
      setLoadingDraftSave(false);
    }
  };

  const runPublishReview = async () => {
    if (!accessToken || !userId) return;

    const errs: string[] = [];
    if (!form.title.trim()) errs.push('Title is required.');
    if (!form.category) errs.push('Category is required.');
    if (!form.label) errs.push('Label is required.');
    const ex = form.excerpt.trim();
    if (!ex) errs.push('Excerpt is required.');
    if (ex.length > 200) errs.push('Excerpt must be 200 characters or less.');

    const wc = wordCountMarkdownExcludingSyntax(form.bodyText);
    if (wc < 300) errs.push('Article body must be at least 300 words to publish.');

    setFieldErrors(errs);
    if (errs.length) return;

    setLoadingPublish(true);
    setPublishOutcome({ kind: 'idle' });
    setBootError('');

    try {
      const payload = buildPayload();
      const headers = jsonAuthHeaders(accessToken);
      let id = articleId;
      let finalSlug = '';

      if (id) {
        const res = await fetch('/api/articles', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ id, ...payload, status: 'pending' }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setBootError(json.error || 'Could not submit for review.');
          setLoadingPublish(false);
          return;
        }
      } else {
        const res = await fetch('/api/articles', {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...payload, status: 'pending' }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setBootError(json.error || 'Could not submit for review.');
          setLoadingPublish(false);
          return;
        }
        id = json.id;
        finalSlug = json.slug || '';
        if (id) {
          setArticleId(id);
          router.replace(`/journalists/submit?id=${encodeURIComponent(id)}`, { scroll: false });
        }
      }

      if (!id) {
        setBootError('Submission failed — missing article id.');
        setLoadingPublish(false);
        return;
      }

      const rev = await fetch('/api/articles/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: id }),
      });

      const reviewJson = await rev.json().catch(() => ({}));
      if (!rev.ok) {
        setBootError(reviewJson.error || 'Automated review failed.');
        setLoadingPublish(false);
        return;
      }

      const slug = String(reviewJson.slug || finalSlug || '');

      if (reviewJson.outcome === 'published') {
        setPublishOutcome({ kind: 'published', slug: slug || 'article' });
      } else if (reviewJson.outcome === 'pending') {
        setPublishOutcome({ kind: 'review' });
      } else {
        setPublishOutcome({
          kind: 'rejected',
          reason: String(reviewJson.reason || ''),
          notes: String(reviewJson.notes || ''),
        });
      }

      setPreviewOpen(false);
    } finally {
      setLoadingPublish(false);
    }
  };

  if (loadingBoot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Navbar />

      <main className="bg-white min-h-screen">
        <div style={{ backgroundColor: NAVY }} className="py-10">
          <div className="max-w-3xl mx-auto px-6 md:px-0">
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: GOLD }}>
              Journalist Portal
            </p>
            <h1
              className="text-2xl md:text-3xl font-bold text-white"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              {isEditing ? 'Editing draft' : 'Submit an article'}
            </h1>
            {draftSavedAt && (
              <p className="text-sm text-green-300 mt-2">
                <span className="font-semibold">Draft saved</span>
                <br />
                <span className="text-green-200/90">{new Date(draftSavedAt).toLocaleString('en-GB')}</span>
              </p>
            )}
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 md:px-0 py-10 space-y-8">
          {bootError && <p className="text-sm text-red-600 border border-red-200 bg-red-50 px-4 py-3 rounded-sm">{bootError}</p>}

          {publishOutcome.kind === 'published' && (
            <div className="border border-green-200 bg-green-50 text-green-900 px-5 py-4 rounded-sm space-y-2">
              <p className="font-semibold">Your article has been published!</p>
              <Link href={`/article/${publishOutcome.slug}`} className="text-green-900 underline hover:text-green-700">
                View your article →
              </Link>
            </div>
          )}
          {publishOutcome.kind === 'review' && (
            <div className="border border-amber-200 bg-amber-50 text-amber-950 px-5 py-4 rounded-sm">
              <p className="font-semibold">Your article is under editorial review.</p>
              <p className="text-sm mt-1">You will hear back within 24 hours.</p>
            </div>
          )}
          {publishOutcome.kind === 'rejected' && (
            <div className="border border-red-200 bg-red-50 rounded-sm px-5 py-4 space-y-3">
              <p className="font-semibold text-red-900">Your article was not accepted</p>
              <div className="text-sm text-red-950 space-y-2">
                {publishOutcome.reason && (
                  <p>
                    <span className="font-semibold">Reason:</span> {publishOutcome.reason}
                  </p>
                )}
                {publishOutcome.notes && (
                  <p>
                    <span className="font-semibold">Editorial notes:</span> {publishOutcome.notes}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="text-sm underline text-red-900 font-semibold"
                onClick={() => setPublishOutcome({ kind: 'idle' })}
              >
                Continue editing below
              </button>
            </div>
          )}

          {fieldErrors.length > 0 && (
            <div className="border border-red-200 bg-red-50 px-5 py-3 rounded-sm">
              <p className="text-sm font-semibold text-red-800 mb-1">Please fix the following:</p>
              <ul className="list-disc pl-5 text-sm text-red-800 space-y-0.5">
                {fieldErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {loadingPublish && (
            <p className="text-sm font-medium text-gray-700">Reviewing your article...</p>
          )}

          <form className="space-y-10" onSubmit={(e) => e.preventDefault()}>
            <section className="space-y-5">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Article metadata</h2>
              <div>
                <label className="sr-only">Title</label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  className="w-full border-0 border-b-2 px-1 py-2 text-2xl md:text-3xl font-bold text-gray-900 focus:outline-none focus:border-amber-600"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                  placeholder="Headline *"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  name="subtitle"
                  value={form.subtitle}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm"
                  placeholder="Optional standfirst"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
                    Category *
                  </label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
                    Label *
                  </label>
                  <select name="label" value={form.label} onChange={handleChange} required className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm bg-white">
                    <option value="">Select label</option>
                    {LABEL_OPTIONS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">Excerpt *</label>
                  <span className="text-xs text-gray-400">{form.excerpt.length} / 200</span>
                </div>
                <textarea
                  name="excerpt"
                  maxLength={200}
                  rows={3}
                  value={form.excerpt}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm resize-none"
                  placeholder="Summary shown on homepage and cards — max 200 characters"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
                  Featured Image URL (optional)
                </label>
                <input
                  type="url"
                  name="featured_image_url"
                  value={form.featured_image_url}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm"
                  placeholder="https://…"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
                  Pen Name * <span className="font-normal text-gray-400">(as shown on articles)</span>
                </label>
                <input
                  type="text"
                  name="pen_name"
                  required
                  value={form.pen_name}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm"
                />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Article body</h2>
                <div className="flex rounded-sm border border-gray-300 overflow-hidden text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setBodyUiMode('write')}
                    className={`px-3 py-1.5 transition-colors ${bodyUiMode === 'write' ? 'bg-[#0f1f3d] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setBodyUiMode('preview')}
                    className={`px-3 py-1.5 border-l border-gray-300 transition-colors ${
                      bodyUiMode === 'preview' ? 'bg-[#0f1f3d] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>

              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-sm px-3 py-2 break-words">
                <span className="font-semibold">Markdown cheatsheet: </span>
                # Heading 1 | ## Heading 2 | ### Heading 3 | **bold** | *italic* | &gt; blockquote | -
                bullet | 1. numbered | --- divider | [link](url) | ![image](url)
              </p>

              {bodyUiMode === 'write' ? (
                <textarea
                  name="bodyText"
                  value={form.bodyText}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-sm px-3 py-3 text-[15px] leading-relaxed focus:outline-none focus:border-amber-600 resize-y"
                  style={{ minHeight: 400 }}
                  placeholder={'Write Markdown here.\n\n## Section heading\n\n> Pull quote\n\n![Illustration](https://…)'}
                  required={false}
                />
              ) : (
                <div className="min-h-[400px] max-h-[70vh] overflow-y-auto border border-gray-300 rounded-sm px-4 py-6 bg-gray-50/60">
                  {form.bodyText.trim() ? (
                    <ArticleBodyRenderer body={{ markdown: form.bodyText }} />
                  ) : (
                    <p className="text-gray-400 text-sm italic">Nothing to preview yet.</p>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-500">
                <strong>{previewWordCount}</strong> words{' '}
                <span className="text-xs text-gray-400">(excluding Markdown punctuation; minimum 300 to publish)</span>
              </p>
            </section>

            <div className="flex flex-wrap gap-3 pt-4">
              <button
                type="button"
                onClick={() => saveDraft()}
                disabled={loadingDraftSave}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm border border-gray-400 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                <Save size={16} />
                {loadingDraftSave ? 'Saving…' : 'Save draft'}
              </button>

              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm border-2 text-sm font-semibold bg-white disabled:opacity-50"
                style={{ borderColor: GOLD, color: GOLD }}
              >
                <Eye size={16} />
                Preview
              </button>

              <button
                type="button"
                onClick={() => runPublishReview()}
                disabled={loadingPublish}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: GOLD }}
              >
                Publish
              </button>
            </div>
          </form>
        </div>
      </main>

      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
            <span className="text-sm font-semibold text-gray-800">Preview</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runPublishReview()}
                disabled={loadingPublish}
                className="px-4 py-2 rounded-sm text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: GOLD }}
              >
                Publish from preview
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-2 rounded-sm border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button type="button" onClick={() => setPreviewOpen(false)} className="p-2 text-gray-500 hover:text-gray-900 lg:hidden" aria-label="Close preview">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="max-w-3xl mx-auto px-6 md:px-0 pt-8 pb-16">
            {fieldErrors.length > 0 && (
              <div className="mb-6 border border-red-200 bg-red-50 px-4 py-3 rounded-sm">
                <p className="text-sm font-semibold text-red-800 mb-1">Cannot publish yet:</p>
                <ul className="text-sm text-red-800 list-disc pl-5">
                  {fieldErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mb-4">
              <CategoryBadge category={form.category} label={form.label} linkable={false} size="md" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-2" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              {form.title || <span className="text-gray-300">Untitled</span>}
            </h1>
            {form.subtitle && <p className="text-lg text-gray-600 mb-4">{form.subtitle}</p>}

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6 border-b border-gray-100 pb-4">
              {form.pen_name && <span className="font-medium text-gray-800">By {form.pen_name}</span>}
              <span>{readMinutes} min read</span>
            </div>

            {form.featured_image_url && (
              <div className="mb-8">
                <img src={form.featured_image_url} alt="" className="w-full rounded-sm object-cover max-h-[420px]" />
              </div>
            )}

            <div className="max-w-[720px] mx-auto px-0 sm:px-0">
              <ArticleBodyRenderer body={{ markdown: form.bodyText }} />
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

export default function JournalistSubmitPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <JournalistSubmitInner />
    </Suspense>
  );
}
