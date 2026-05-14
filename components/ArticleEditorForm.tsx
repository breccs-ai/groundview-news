'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CATEGORY_OPTIONS,
  LABEL_OPTIONS,
  STATUS_OPTIONS,
  normalizeArticleCategory,
  normalizeArticleLabel,
} from '@/lib/admin-auth';
import { generateSlug } from '@/lib/slug';
import {
  markdownBodyPayload,
  storedBodyToEditorMarkdown,
  wordCountMarkdownExcludingSyntax,
} from '@/lib/article-markdown';
import ArticleBodyRenderer from '@/components/ArticleBodyRenderer';
import CategoryBadge from '@/components/CategoryBadge';
import type { ArticleBody } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { Save, Globe, ArrowLeft, Eye, X, Trash2 } from 'lucide-react';

type ArticleForm = {
  title: string;
  subtitle: string;
  author_name: string;
  category: string;
  label: string;
  excerpt: string;
  featured_image_url: string;
  bodyText: string;
  status: string;
};

type Props = {
  articleId?: string;
};

const EMPTY_FORM: ArticleForm = {
  title: '',
  subtitle: '',
  author_name: 'Ground View Editor',
  category: 'commentary',
  label: 'Commentary',
  excerpt: '',
  featured_image_url: '',
  bodyText: '',
  status: 'draft',
};

function statusOptionLabel(s: string): string {
  if (s === 'pending_editorial') return 'Pending editorial';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function triggerClientRevalidate(slug: string) {
  await fetch('/api/revalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  }).catch(() => {});
}

export default function ArticleEditorForm({ articleId }: Props) {
  const router = useRouter();
  const isEdit = !!articleId;

  const [form, setForm] = useState<ArticleForm>(EMPTY_FORM);
  const [originalSlug, setOriginalSlug] = useState('');
  const [loadedPublishedAt, setLoadedPublishedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bodyUiMode, setBodyUiMode] = useState<'write' | 'preview'>('write');
  const [imageGenLoading, setImageGenLoading] = useState(false);
  const [imageGenNotice, setImageGenNotice] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const loadArticle = useCallback(async () => {
    if (!articleId) return;
    const res = await fetch(`/api/articles?id=${encodeURIComponent(articleId)}`, {
      credentials: 'include',
    });
    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      setLoadError('Unauthorized. Sign in to the admin panel and try again.');
      setLoading(false);
      return;
    }
    if (!res.ok || !json.article) {
      setLoadError(json.error || 'Article not found.');
      setLoading(false);
      return;
    }

    const data = json.article as Record<string, unknown>;
    setOriginalSlug(String(data.slug || ''));
    setLoadedPublishedAt(
      typeof data.published_at === 'string' ? data.published_at : null
    );

    const rawStatus = typeof data.status === 'string' ? data.status : 'draft';

    setForm({
      title: String(data.title || ''),
      subtitle: String(data.subtitle || ''),
      author_name: String(data.author_name || 'Ground View Editor'),
      category: normalizeArticleCategory(
        typeof data.category === 'string' ? data.category : undefined
      ),
      label: normalizeArticleLabel(
        typeof data.label === 'string' ? data.label : undefined
      ),
      excerpt: String(data.excerpt || ''),
      featured_image_url: String(data.featured_image_url || ''),
      bodyText: storedBodyToEditorMarkdown(data.body),
      status: rawStatus,
    });
    setLoading(false);
  }, [articleId]);

  useEffect(() => {
    if (!isEdit) return;
    loadArticle();
  }, [isEdit, loadArticle]);

  useEffect(() => {
    document.body.style.overflow = previewOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [previewOpen]);

  const handleField = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setSaveStatus('idle');
  };

  const generateFeaturedImage = async () => {
    setImageGenNotice(null);
    if (!form.title.trim()) {
      setImageGenNotice({
        ok: false,
        text: 'Image generation failed. Please try again.',
      });
      return;
    }
    setImageGenLoading(true);
    try {
      const res = await fetch('/api/articles/generate-image', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          excerpt: form.excerpt,
          category: normalizeArticleCategory(form.category),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.imageUrl) {
        setImageGenNotice({
          ok: false,
          text: 'Image generation failed. Please try again.',
        });
        return;
      }
      setForm((prev) => ({ ...prev, featured_image_url: String(json.imageUrl) }));
      setImageGenNotice({ ok: true, text: 'Image generated successfully' });
    } catch {
      setImageGenNotice({
        ok: false,
        text: 'Image generation failed. Please try again.',
      });
    } finally {
      setImageGenLoading(false);
    }
  };

  const buildContentPayload = () => {
    const body = markdownBodyPayload(form.bodyText);
    const category = normalizeArticleCategory(form.category);
    const label = normalizeArticleLabel(form.label);
    return {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      author_name: form.author_name.trim() || 'Ground View Editor',
      category,
      label,
      excerpt: form.excerpt.trim(),
      featured_image_url: form.featured_image_url.trim(),
      body,
    };
  };

  /** Edit only: save fields without changing publication status or timestamps. */
  const saveChanges = async () => {
    if (!articleId) return;
    if (!form.title.trim()) {
      setSaveMsg('Title is required.');
      setSaveStatus('error');
      return;
    }

    setSaving(true);
    setSaveStatus('idle');

    const content = buildContentPayload();
    const res = await fetch('/api/articles', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: articleId, ...content }),
    });

    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setSaveMsg(json.error || `Server error ${res.status}`);
      setSaveStatus('error');
      return;
    }

    await triggerClientRevalidate(originalSlug);
    const ts = new Date().toLocaleString();
    setSaveMsg(`Article updated successfully — ${ts}`);
    setSaveStatus('saved');
  };

  const publishArticle = async () => {
    if (!articleId) return;
    setSaving(true);
    setSaveStatus('idle');
    const now = new Date().toISOString();
    const published_at = loadedPublishedAt || now;

    const res = await fetch('/api/articles', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: articleId,
        status: 'published',
        published_at,
      }),
    });

    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setSaveMsg(json.error || `Server error ${res.status}`);
      setSaveStatus('error');
      return;
    }

    setLoadedPublishedAt(published_at);
    setForm((prev) => ({ ...prev, status: 'published' }));
    await triggerClientRevalidate(originalSlug);
    const ts = new Date().toLocaleString();
    setSaveMsg(`Published — ${ts}`);
    setSaveStatus('saved');
  };

  const unpublishArticle = async () => {
    if (!articleId) return;
    setSaving(true);
    setSaveStatus('idle');

    const res = await fetch('/api/articles', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: articleId,
        status: 'draft',
      }),
    });

    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setSaveMsg(json.error || `Server error ${res.status}`);
      setSaveStatus('error');
      return;
    }

    setForm((prev) => ({ ...prev, status: 'draft' }));
    await triggerClientRevalidate(originalSlug);
    const ts = new Date().toLocaleString();
    setSaveMsg(`Unpublished (draft) — ${ts}`);
    setSaveStatus('saved');
  };

  const deleteArticle = async () => {
    if (!articleId) return;
    if (
      !window.confirm(
        'Delete this article permanently? This cannot be undone.'
      )
    ) {
      return;
    }

    setSaving(true);
    setSaveStatus('idle');

    const res = await fetch('/api/articles', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: articleId }),
    });

    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setSaveMsg(json.error || `Server error ${res.status}`);
      setSaveStatus('error');
      return;
    }

    await triggerClientRevalidate(originalSlug);
    router.push('/admin/dashboard');
  };

  const saveNewArticle = async (publishNow?: boolean) => {
    if (!form.title.trim()) {
      setSaveMsg('Title is required.');
      setSaveStatus('error');
      return;
    }

    setSaving(true);
    setSaveStatus('idle');

    const status = publishNow ? 'published' : form.status;
    const body = markdownBodyPayload(form.bodyText);
    const now = new Date().toISOString();
    const category = normalizeArticleCategory(form.category);
    const label = normalizeArticleLabel(form.label);

    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      author_name: form.author_name.trim() || 'Ground View Editor',
      category,
      label,
      excerpt: form.excerpt.trim(),
      featured_image_url: form.featured_image_url.trim(),
      body,
      status,
      ...(publishNow || status === 'published' ? { published_at: now } : {}),
    };

    const res = await fetch('/api/articles', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      console.error('[ArticleEditorForm] save error:', json.error);
      setSaveMsg(json.error || `Server error ${res.status}`);
      setSaveStatus('error');
      return;
    }

    setSaveStatus('saved');
    setSaveMsg(publishNow ? 'Published!' : 'Saved.');
    setTimeout(() => router.push('/admin/dashboard'), 1000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-red-600 mb-4">{loadError}</p>
        <button
          type="button"
          onClick={() => router.push('/admin/dashboard')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to dashboard
        </button>
      </div>
    );
  }

  const previewArticleBody = { markdown: form.bodyText } as ArticleBody;
  const displayLabel =
    form.label ||
    CATEGORY_OPTIONS.find((c) => c.value === form.category)?.label ||
    '';

  const isPublished = form.status === 'published';

  const statusSelectOptions = STATUS_OPTIONS.includes(form.status)
    ? STATUS_OPTIONS
    : [...STATUS_OPTIONS, form.status];

  return (
    <div>
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 bg-gray-950 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                Preview
              </span>
              <span className="text-xs text-gray-500">
                This is how the article will appear to readers
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <X size={14} />
              Close preview
            </button>
          </div>

          <main className="bg-white flex-1">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-6">
              <div className="mb-4">
                <CategoryBadge category={form.category} label={displayLabel} size="md" />
              </div>
              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-4"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                {form.title || <span className="text-gray-300">Untitled article</span>}
              </h1>
              {form.subtitle && (
                <p className="text-lg sm:text-xl text-gray-600 leading-relaxed mb-6 font-light">
                  {form.subtitle}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: '#0f1f3d' }}
                  >
                    {form.author_name ? form.author_name[0].toUpperCase() : 'G'}
                  </div>
                  <div>
                    {form.author_name && (
                      <p className="text-sm font-semibold text-gray-900">{form.author_name}</p>
                    )}
                    <p className="text-xs text-gray-400">{formatDate(new Date().toISOString())}</p>
                  </div>
                </div>
              </div>
            </div>

            {form.featured_image_url && (
              <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-8">
                <div className="relative w-full aspect-[16/8] overflow-hidden rounded-sm bg-gray-100">
                  <img
                    src={form.featured_image_url}
                    alt={form.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
              {form.bodyText ? (
                <ArticleBodyRenderer body={previewArticleBody} />
              ) : (
                <p className="text-gray-300 italic">No body content yet.</p>
              )}

              <div className="mt-10 pt-6 border-t border-gray-100">
                <CategoryBadge category={form.category} label={displayLabel} />
                {form.author_name && (
                  <p className="mt-1 text-xs text-gray-400">By {form.author_name}</p>
                )}
              </div>
            </div>
          </main>
        </div>
      )}

      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/dashboard')}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            {isEdit ? 'Edit Article' : 'New Article'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-end">
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-700 font-medium max-w-[min(100vw-2rem,280px)] text-right">
              {saveMsg}
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-600 font-medium max-w-[min(100vw-2rem,280px)] text-right">
              {saveMsg}
            </span>
          )}

          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-semibold text-gray-700 rounded-sm hover:border-gray-500 hover:text-gray-900 transition-colors"
          >
            <Eye size={14} />
            PREVIEW
          </button>

          {isEdit ? (
            <>
              <button
                type="button"
                onClick={() => saveChanges()}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-800 bg-gray-900 text-white text-sm font-semibold rounded-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? 'Saving…' : 'SAVE CHANGES'}
              </button>
              {isPublished ? (
                <button
                  type="button"
                  onClick={() => unpublishArticle()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-amber-700 text-amber-900 text-sm font-semibold rounded-sm hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  UNPUBLISH
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => publishArticle()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-sm transition-colors disabled:opacity-50"
                >
                  <Globe size={14} />
                  {saving ? 'Publishing…' : 'PUBLISH'}
                </button>
              )}
              <button
                type="button"
                onClick={() => deleteArticle()}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 text-sm font-semibold rounded-sm hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                DELETE
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => saveNewArticle(false)}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-semibold text-gray-700 rounded-sm hover:border-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => saveNewArticle(true)}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-sm transition-colors disabled:opacity-50"
              >
                <Globe size={14} />
                {saving ? 'Publishing…' : 'Publish'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-sm p-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Headline *
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleField}
              required
              className="w-full border-0 border-b border-gray-200 pb-2 text-xl font-bold text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              placeholder="Article headline"
            />
            {form.title && (
              <p className="mt-2 text-xs text-gray-400">
                Slug:{' '}
                <span className="font-mono">
                  {isEdit ? originalSlug || generateSlug(form.title) : generateSlug(form.title)}
                </span>
              </p>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Subtitle / Standfirst
            </label>
            <input
              type="text"
              name="subtitle"
              value={form.subtitle}
              onChange={handleField}
              className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
              placeholder="One-sentence summary or opening hook"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500">
                Article Body (Markdown)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBodyUiMode('write')}
                  className={`px-3 py-1 text-xs font-semibold rounded-sm border transition-colors ${
                    bodyUiMode === 'write'
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-300 text-gray-600 hover:border-gray-500'
                  }`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setBodyUiMode('preview')}
                  className={`px-3 py-1 text-xs font-semibold rounded-sm border transition-colors ${
                    bodyUiMode === 'preview'
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-300 text-gray-600 hover:border-gray-500'
                  }`}
                >
                  Live preview
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="text-xs text-gray-400 hover:text-blue-700 flex items-center gap-1 transition-colors"
                >
                  <Eye size={12} />
                  Full preview
                </button>
              </div>
            </div>
            <p className="mb-3 text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-sm px-3 py-2 break-words">
              <span className="font-semibold">Markdown: </span>
              # Heading 1 | ## Heading 2 | ### Heading 3 | **bold** | *italic* | &gt; blockquote | -
              bullet | 1. numbered | --- divider | [link](url) | ![image](url)
            </p>
            {bodyUiMode === 'write' ? (
              <textarea
                name="bodyText"
                value={form.bodyText}
                onChange={handleField}
                rows={22}
                className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 leading-relaxed focus:outline-none focus:border-blue-800 transition-colors resize-y min-h-[400px]"
                placeholder={'Start with lead paragraphs.\n\n## Section heading\n\n> Pull quote'}
              />
            ) : (
              <div className="min-h-[400px] max-h-[70vh] overflow-y-auto border border-gray-200 rounded-sm px-4 py-6 bg-gray-50/50">
                {form.bodyText.trim() ? (
                  <ArticleBodyRenderer body={{ markdown: form.bodyText }} />
                ) : (
                  <p className="text-gray-400 text-sm italic">Nothing to preview yet.</p>
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Word count{' '}
              <span className="font-semibold text-gray-800">
                {wordCountMarkdownExcludingSyntax(form.bodyText)}
              </span>{' '}
              <span className="text-gray-400">(excludes Markdown punctuation)</span>
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Excerpt
              <span className="normal-case tracking-normal font-normal text-gray-400 ml-2">
                (used for SEO and article cards)
              </span>
            </label>
            <textarea
              name="excerpt"
              value={form.excerpt}
              onChange={handleField}
              rows={3}
              className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors resize-none"
              placeholder="A 1–2 sentence summary for search engines and article preview cards"
            />
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-sm p-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Status
            </label>
            <select
              name="status"
              value={form.status}
              onChange={handleField}
              disabled={isEdit}
              className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-800 bg-white transition-colors disabled:bg-gray-50 disabled:text-gray-600"
            >
              {statusSelectOptions.map((s) => (
                <option key={s} value={s}>
                  {statusOptionLabel(s)}
                </option>
              ))}
            </select>
            {isEdit && (
              <p className="mt-2 text-xs text-gray-500">
                Use <span className="font-semibold">Publish</span> or{' '}
                <span className="font-semibold">Unpublish</span> to change status.
              </p>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Category *
            </label>
            <select
              name="category"
              value={form.category}
              onChange={handleField}
              required
              className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-800 bg-white transition-colors"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Label
            </label>
            <select
              name="label"
              value={form.label}
              onChange={handleField}
              className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-800 bg-white transition-colors"
            >
              {LABEL_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Author Name
            </label>
            <input
              type="text"
              name="author_name"
              value={form.author_name}
              onChange={handleField}
              className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
              placeholder="Ground View Editor"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-sm p-5">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Featured Image URL
            </label>
            <div className="flex flex-wrap gap-2 items-stretch sm:items-center">
              <input
                type="url"
                name="featured_image_url"
                value={form.featured_image_url}
                onChange={handleField}
                className="flex-1 min-w-[12rem] border border-gray-200 rounded-sm px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                placeholder="https://images.pexels.com/…"
              />
              <button
                type="button"
                onClick={() => generateFeaturedImage()}
                disabled={imageGenLoading}
                className="inline-flex shrink-0 items-center justify-center px-4 py-2 text-sm font-semibold rounded-sm text-[#1a1a1a] bg-[#d4af37] hover:bg-[#c9a227] transition-colors disabled:opacity-60 disabled:pointer-events-none"
              >
                {imageGenLoading ? 'Generating image...' : 'Generate Image'}
              </button>
            </div>
            {imageGenNotice && (
              <p
                className={`mt-2 text-xs font-medium ${
                  imageGenNotice.ok ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {imageGenNotice.text}
              </p>
            )}
            {form.featured_image_url && (
              <div className="mt-3 w-full aspect-video overflow-hidden rounded-sm bg-gray-100">
                <img
                  src={form.featured_image_url}
                  alt="Featured preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-sm font-semibold text-gray-700 rounded-sm hover:border-gray-500 transition-colors"
            >
              <Eye size={14} />
              Preview article
            </button>

            {isEdit ? (
              <>
                <button
                  type="button"
                  onClick={() => saveChanges()}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-sm transition-colors disabled:opacity-50"
                >
                  <Save size={14} />
                  {saving ? 'Saving…' : 'SAVE CHANGES'}
                </button>
                {isPublished ? (
                  <button
                    type="button"
                    onClick={() => unpublishArticle()}
                    disabled={saving}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-amber-700 text-amber-900 text-sm font-semibold rounded-sm hover:bg-amber-50 transition-colors disabled:opacity-50"
                  >
                    UNPUBLISH
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => publishArticle()}
                    disabled={saving}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-sm transition-colors disabled:opacity-50"
                  >
                    <Globe size={14} />
                    {saving ? 'Publishing…' : 'PUBLISH'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteArticle()}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-red-300 text-red-700 text-sm font-semibold rounded-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  DELETE
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => saveNewArticle(true)}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-sm transition-colors disabled:opacity-50"
                >
                  <Globe size={14} />
                  {saving ? 'Publishing…' : 'Publish now'}
                </button>
                <button
                  type="button"
                  onClick={() => saveNewArticle(false)}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 text-sm font-semibold text-gray-700 rounded-sm hover:border-gray-500 transition-colors disabled:opacity-50"
                >
                  <Save size={14} />
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
              </>
            )}
          </div>

          {saveStatus === 'error' && (
            <p className="text-xs text-red-600 font-medium text-center">{saveMsg}</p>
          )}
        </div>
      </div>
    </div>
  );
}
