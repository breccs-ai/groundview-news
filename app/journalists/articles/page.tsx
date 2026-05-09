'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CategoryBadge from '@/components/CategoryBadge';
import { supabase, getCategoryMeta } from '@/lib/supabase';
import { Eye } from 'lucide-react';

const GOLD = '#D4AF37';
const NAVY = '#0f1f3d';

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  label?: string | null;
  published_at: string | null;
  views?: number | null;
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function JournalistPublishedArticlesPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/journalists/login');
      return;
    }

    const { data, error } = await supabase
      .from('articles')
      .select('id, title, slug, category, label, published_at, views')
      .eq('author_id', user.id)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) {
      console.error('[journalists/articles]', error.message);
      setArticles([]);
    } else {
      setArticles((data as ArticleRow[]) || []);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Navbar />
      <main className="bg-white min-h-screen">
        <div style={{ backgroundColor: NAVY }} className="py-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">
                Journalist Portal
              </p>
              <h1
                className="text-2xl md:text-3xl font-bold text-white"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                Published articles
              </h1>
              <p className="text-gray-400 text-sm mt-1">Only articles that are live on the site.</p>
            </div>
            <Link
              href="/journalists/dashboard"
              className="text-sm font-semibold text-amber-200 hover:text-white transition-colors"
            >
              ← Back to dashboard
            </Link>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-sm">
              <p className="text-gray-500 mb-4">No published articles yet.</p>
              <Link
                href="/journalists/submit"
                className="inline-flex px-5 py-2.5 text-sm font-semibold rounded-sm text-[#1a1a1a]"
                style={{ backgroundColor: GOLD }}
              >
                Submit an article
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map((article) => {
                const cat = getCategoryMeta(article.category);
                return (
                  <div
                    key={article.id}
                    className="border border-gray-200 rounded-sm p-4 flex flex-col lg:flex-row lg:items-center gap-4 lg:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <CategoryBadge category={article.category} label={article.label || cat.label} />
                      <Link
                        href={`/articles/${article.slug}`}
                        className="text-lg font-bold text-gray-900 hover:text-amber-800 transition-colors break-words block"
                        style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                      >
                        {article.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <span>Published {fmtDate(article.published_at)}</span>
                        <span className="inline-flex items-center gap-1">
                          <Eye size={14} className="text-gray-400" />
                          {Number(article.views) || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
