export const dynamic = 'force-dynamic';
export const revalidate = 0;

import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CategoryBadge from '@/components/CategoryBadge';
import CategoryFilter from '@/components/CategoryFilter';
import NewsletterSignup from '@/components/NewsletterSignup';
import { getPublishedArticles } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Ground View News: Independent Global Commentary',
  description:
    'Independent commentary on global affairs: Africa, the African diaspora, human rights, world politics, and the global economy.',
};

export default async function HomePage() {
  const articles = await getPublishedArticles();

  const featured = articles[0] || null;
  const secondary = articles.slice(1);

  return (
    <>
      <Navbar />

      <main>
        {/* Featured article */}
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-12">
            {featured ? (
              <article>
                {/* Featured image */}
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

                <h1
                  className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                >
                  {featured.title}
                </h1>

                {featured.subtitle && (
                  <p className="mt-4 text-lg sm:text-xl text-gray-600 leading-relaxed font-light">
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
            ) : (
              <EmptyState />
            )}
          </div>
        </section>

        {/* Secondary articles list */}
        {secondary.length > 0 && (
          <section className="bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
              <div className="mb-8">
                <CategoryFilter />
              </div>

              <div className="divide-y divide-gray-100">
                {secondary.map((article) => (
                  <article key={article.id} className="py-6">
                    <CategoryBadge category={article.category} label={article.label} />
                    <h2
                      className="mt-2 text-xl sm:text-2xl font-bold text-gray-900 leading-snug hover:text-blue-900 transition-colors"
                      style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                    >
                      <Link href={`/article/${article.slug}`}>{article.title}</Link>
                    </h2>
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
            </div>
          </section>
        )}

        {/* Divider banner */}
        <div style={{ backgroundColor: '#0f1f3d' }} className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p
              className="text-white text-lg md:text-xl font-semibold"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Ground up. Not top down.
            </p>
            <p className="text-gray-400 text-sm max-w-md text-center md:text-right">
              Independent journalism on the stories that matter, from Africa to the global stage.
            </p>
          </div>
        </div>

        <NewsletterSignup />
      </main>

      <Footer />
    </>
  );
}

function EmptyState() {
  return (
    <div className="py-16 text-center">
      <div className="max-w-lg mx-auto">
        <span
          className="block text-7xl font-bold mb-6 select-none"
          style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#e8edf5' }}
          aria-hidden="true"
        >
          GV
        </span>
        <h2
          className="text-2xl font-bold text-gray-900 mb-3"
          style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
        >
          Our first articles are coming soon.
        </h2>
        <p className="text-gray-500 text-base mb-6">
          Subscribe to be notified when we publish.
        </p>
        <a
          href="#newsletter"
          className="inline-flex items-center px-6 py-3 bg-gray-900 text-white text-sm font-semibold rounded-sm hover:bg-blue-900 transition-colors"
        >
          Subscribe
        </a>
      </div>
    </div>
  );
}
