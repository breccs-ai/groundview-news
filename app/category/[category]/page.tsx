export const dynamic = 'force-dynamic';
export const revalidate = 0;

import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CategoryBadge from '@/components/CategoryBadge';
import CategoryFilter from '@/components/CategoryFilter';
import NewsletterSignup from '@/components/NewsletterSignup';
import { getPublishedArticles, getCategoryMeta, CATEGORIES } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';

type Props = {
  params: { category: string };
};

export async function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const meta = getCategoryMeta(params.category);
  return {
    title: `${meta.label} | Ground View News`,
    description: `Read the latest ${meta.label} articles from Ground View News, independent global commentary.`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = params;
  const meta = getCategoryMeta(category);
  const articles = await getPublishedArticles({ category });

  const featured = articles[0] || null;
  const secondary = articles.slice(1);

  return (
    <>
      <Navbar />

      <main className="bg-white">
        {/* Page header */}
        <div style={{ backgroundColor: '#0f1f3d' }} className="py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <span
              className={`inline-flex items-center text-xs font-semibold uppercase tracking-widest rounded-sm px-2.5 py-1 mb-4 ${meta.bg} ${meta.text}`}
            >
              {meta.label}
            </span>
            <h1
              className="text-3xl md:text-4xl font-bold text-white"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              {meta.label}
            </h1>
            <p className="mt-2 text-gray-400 text-sm">
              {articles.length} {articles.length === 1 ? 'article' : 'articles'} published
            </p>
          </div>
        </div>

        {/* Category filter tabs */}
        <div className="border-b border-gray-100 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
            <CategoryFilter active={category} />
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          {featured && (
            <>
              {/* Featured article */}
              <article className="mb-12 pb-12 border-b border-gray-200">
                {featured.featured_image_url && (
                  <div className="w-full aspect-[16/8] overflow-hidden rounded-sm bg-gray-100 mb-7">
                    <img
                      src={featured.featured_image_url}
                      alt={featured.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <CategoryBadge category={featured.category} label={featured.label} size="md" />

                <h2
                  className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 leading-tight"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                >
                  {featured.title}
                </h2>

                {featured.subtitle && (
                  <p className="mt-4 text-lg text-gray-600 leading-relaxed font-light">
                    {featured.subtitle}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-3 text-sm text-gray-500">
                  {featured.author_name && (
                    <>
                      <span className="font-medium text-gray-700">{featured.author_name}</span>
                      <span className="text-gray-300">·</span>
                    </>
                  )}
                  <span>{formatDate(featured.published_at)}</span>
                </div>

                {featured.excerpt && (
                  <p className="mt-5 text-base text-gray-700 leading-relaxed border-t border-gray-100 pt-5">
                    {featured.excerpt}
                  </p>
                )}

                <div className="mt-7">
                  <Link
                    href={`/article/${featured.slug}`}
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-sm transition-colors"
                    style={{ backgroundColor: '#B8860B', color: '#fff' }}
                  >
                    Read Full Article →
                  </Link>
                </div>
              </article>

              {/* Secondary articles list */}
              {secondary.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {secondary.map((article) => (
                    <article key={article.id} className="py-6">
                      <CategoryBadge category={article.category} label={article.label} />
                      <h3
                        className="mt-2 text-xl sm:text-2xl font-bold text-gray-900 leading-snug hover:text-blue-900 transition-colors"
                        style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                      >
                        <Link href={`/article/${article.slug}`}>{article.title}</Link>
                      </h3>
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                        {article.author_name && (
                          <>
                            <span className="font-medium text-gray-600">{article.author_name}</span>
                            <span className="text-gray-300">·</span>
                          </>
                        )}
                        <span>{formatDate(article.published_at)}</span>
                      </div>
                      {article.excerpt && (
                        <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-2">
                          {article.excerpt}
                        </p>
                      )}
                      <Link
                        href={`/article/${article.slug}`}
                        className="mt-3 inline-flex items-center text-sm font-semibold transition-colors"
                        style={{ color: '#B8860B' }}
                      >
                        Read More →
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <NewsletterSignup />
      </main>

      <Footer />
    </>
  );
}
