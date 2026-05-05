'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase, CATEGORIES } from '@/lib/supabase';
import { CircleCheck as CheckCircle, Info } from 'lucide-react';

type BlockType = 'paragraph' | 'heading' | 'image';

type Block = {
  id: string;
  type: BlockType;
  text?: string;
  level?: 2 | 3;
  url?: string;
  caption?: string;
};

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function SubmitPage() {
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    author_name: '',
    category: '',
    excerpt: '',
    featured_image_url: '',
  });
  const [blocks, setBlocks] = useState<Block[]>([
    { id: generateId(), type: 'paragraph', text: '' },
  ]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedSlug, setSubmittedSlug] = useState('');

  const handleField = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const addBlock = (type: BlockType) => {
    setBlocks((prev) => [
      ...prev,
      { id: generateId(), type, text: '', level: 2, url: '', caption: '' },
    ]);
  };

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const slugify = (title: string) =>
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    if (!form.category) {
      setErrorMsg('Please select a category.');
      setStatus('error');
      return;
    }

    const slug = slugify(form.title) + '-' + Date.now().toString(36);
    const body = {
      content: blocks.map(({ id: _id, ...rest }) => rest),
    };

    const { error } = await supabase.from('articles').insert({
      title: form.title,
      subtitle: form.subtitle,
      author_name: form.author_name,
      category: form.category,
      label: CATEGORIES.find((c) => c.slug === form.category)?.label || form.category,
      excerpt: form.excerpt,
      featured_image_url: form.featured_image_url,
      slug,
      body,
      status: 'draft',
    });

    if (error) {
      setErrorMsg(error.message || 'Something went wrong. Please try again.');
      setStatus('error');
    } else {
      setStatus('success');
      setSubmittedSlug(slug);
    }
  };

  if (status === 'success') {
    return (
      <>
        <Navbar />
        <main className="bg-white min-h-[60vh] flex items-center justify-center py-20">
          <div className="max-w-lg mx-auto px-4 text-center">
            <div className="flex justify-center mb-5">
              <CheckCircle size={40} className="text-green-600" />
            </div>
            <h1
              className="text-2xl font-bold text-gray-900 mb-3"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Article submitted
            </h1>
            <p className="text-gray-600 text-sm leading-relaxed mb-2">
              Your article has been saved as a <strong>draft</strong> and is pending editorial review.
              It will not appear on the site until an editor publishes it.
            </p>
            <p className="text-xs text-gray-400 mb-8 font-mono break-all">Slug: {submittedSlug}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  setStatus('idle');
                  setForm({ title: '', subtitle: '', author_name: '', category: '', excerpt: '', featured_image_url: '' });
                  setBlocks([{ id: generateId(), type: 'paragraph', text: '' }]);
                  setSubmittedSlug('');
                }}
                className="px-6 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-sm hover:bg-blue-900 transition-colors"
              >
                Submit another article
              </button>
              <a
                href="/"
                className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-sm hover:border-gray-500 transition-colors"
              >
                Return to homepage
              </a>
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

      <main className="bg-white">
        {/* Header */}
        <div style={{ backgroundColor: '#0f1f3d' }} className="py-14">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-4">
              Journalist Portal
            </p>
            <h1
              className="text-3xl md:text-4xl font-bold text-white leading-tight"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Submit an article
            </h1>
            <p className="mt-3 text-gray-400 text-sm leading-relaxed">
              Articles are saved as drafts and reviewed by the editorial team before publication.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">

          {/* Article metadata */}
          <section>
            <h2
              className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-6 pb-3 border-b border-gray-100"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Article Details
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Headline *
                </label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleField}
                  required
                  maxLength={200}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-base font-serif text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                  placeholder="The headline of your article"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Subtitle / Standfirst
                </label>
                <input
                  type="text"
                  name="subtitle"
                  value={form.subtitle}
                  onChange={handleField}
                  maxLength={300}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                  placeholder="A one-sentence summary or opening hook"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                    Author Name *
                  </label>
                  <input
                    type="text"
                    name="author_name"
                    value={form.author_name}
                    onChange={handleField}
                    required
                    className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                    placeholder="Your pen name or full name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                    Category *
                  </label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleField}
                    required
                    className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors bg-white"
                  >
                    <option value="">Select a category</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat.slug} value={cat.slug}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Excerpt
                  <span className="normal-case tracking-normal font-normal text-gray-400 ml-2">
                    (used in article previews and SEO)
                  </span>
                </label>
                <textarea
                  name="excerpt"
                  value={form.excerpt}
                  onChange={handleField}
                  rows={2}
                  maxLength={500}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors resize-none"
                  placeholder="A 1–2 sentence summary for search engines and article cards"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Featured Image URL
                </label>
                <input
                  type="url"
                  name="featured_image_url"
                  value={form.featured_image_url}
                  onChange={handleField}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                  placeholder="https://images.pexels.com/…"
                />
                {form.featured_image_url && (
                  <div className="mt-2 w-full aspect-[16/6] overflow-hidden rounded-sm bg-gray-100">
                    <img
                      src={form.featured_image_url}
                      alt="Featured image preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Article body */}
          <section>
            <h2
              className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-6 pb-3 border-b border-gray-100"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Article Body
            </h2>

            <div className="space-y-4">
              {blocks.map((block, idx) => (
                <div key={block.id} className="group relative border border-gray-200 rounded-sm p-4 bg-gray-50 hover:border-gray-300 transition-colors">
                  {/* Block controls */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                      {block.type === 'paragraph'
                        ? 'Paragraph'
                        : block.type === 'heading'
                        ? `Heading H${block.level || 2}`
                        : 'Image'}
                    </span>
                    <div className="flex items-center gap-1">
                      {block.type === 'heading' && (
                        <select
                          value={block.level || 2}
                          onChange={(e) =>
                            updateBlock(block.id, { level: Number(e.target.value) as 2 | 3 })
                          }
                          className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-600 focus:outline-none"
                        >
                          <option value={2}>H2</option>
                          <option value={3}>H3</option>
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => moveBlock(block.id, -1)}
                        disabled={idx === 0}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBlock(block.id, 1)}
                        disabled={idx === blocks.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBlock(block.id)}
                        className="p-1 text-gray-400 hover:text-red-600 text-xs ml-1"
                        title="Remove block"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {block.type === 'paragraph' && (
                    <textarea
                      value={block.text || ''}
                      onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                      rows={4}
                      className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-sm text-gray-900 leading-relaxed focus:outline-none focus:border-blue-800 transition-colors resize-y"
                      placeholder="Write your paragraph here…"
                    />
                  )}

                  {block.type === 'heading' && (
                    <input
                      type="text"
                      value={block.text || ''}
                      onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-base font-bold text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                      style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                      placeholder="Section heading"
                    />
                  )}

                  {block.type === 'image' && (
                    <div className="space-y-2">
                      <input
                        type="url"
                        value={block.url || ''}
                        onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors"
                        placeholder="Image URL (https://…)"
                      />
                      <input
                        type="text"
                        value={block.caption || ''}
                        onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-sm px-3 py-2 text-sm text-gray-500 focus:outline-none focus:border-blue-800 transition-colors"
                        placeholder="Caption (optional)"
                      />
                      {block.url && (
                        <div className="w-full aspect-[16/7] overflow-hidden rounded-sm bg-gray-200">
                          <img src={block.url} alt={block.caption || ''} className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add block buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addBlock('paragraph')}
                className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-sm text-gray-600 hover:border-gray-500 hover:text-gray-900 transition-colors"
              >
                + Paragraph
              </button>
              <button
                type="button"
                onClick={() => addBlock('heading')}
                className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-sm text-gray-600 hover:border-gray-500 hover:text-gray-900 transition-colors"
              >
                + Heading
              </button>
              <button
                type="button"
                onClick={() => addBlock('image')}
                className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-sm text-gray-600 hover:border-gray-500 hover:text-gray-900 transition-colors"
              >
                + Image
              </button>
            </div>
          </section>

          {/* Notice */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-sm">
            <Info size={15} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 leading-relaxed">
              Submitted articles are saved as <strong>drafts</strong>. They will not appear on the site until
              reviewed and published by an editor. Please ensure your article meets our{' '}
              <a href="/editorial-policy" className="underline hover:no-underline">
                editorial standards
              </a>
              .
            </p>
          </div>

          {/* Error */}
          {status === 'error' && (
            <p className="text-sm text-red-600 font-medium">{errorMsg}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-3.5 bg-gray-900 hover:bg-blue-900 text-white font-semibold text-sm rounded-sm transition-colors duration-150 disabled:opacity-60"
          >
            {status === 'loading' ? 'Submitting…' : 'Submit article for review'}
          </button>
        </form>
      </main>

      <Footer />
    </>
  );
}
