export const dynamic = 'force-dynamic';
export const revalidate = 0;

import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ArticleCard from '@/components/ArticleCard';
import CategoryFilter from '@/components/CategoryFilter';
import NewsletterSignup from '@/components/NewsletterSignup';
import { getPublishedArticles } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Ground View News: Independent Global Commentary',
  description:
    'Independent commentary on global affairs: Africa, the African diaspora, human rights, world politics, and the global economy.',
};

export default async function HomePage() {
  const articles = await getPublishedArticles();

  const featuredArticle = articles[0] || null;
  const gridArticles = articles.slice(1);

  return (
    <>
      <Navbar />

      <main>
        {/* Hero / Featured article */}
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-10">
            {featuredArticle ? (
              <div className="grid lg:grid-cols-5 gap-8 items-start">
                <div className="lg:col-span-3">
                  <ArticleCard article={featuredArticle} variant="featured" />
                </div>
                {gridArticles.length > 0 && (
                  <div className="lg:col-span-2 divide-y divide-gray-100">
                    {gridArticles.slice(0, 4).map((article) => (
                      <ArticleCard key={article.id} article={article} variant="compact" />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </section>

        {/* Category filter + article grid */}
        <section className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
            <div className="mb-8">
              <CategoryFilter />
            </div>

            {gridArticles.length > 4 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                {gridArticles.slice(4).map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            ) : articles.length > 1 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                {articles.slice(1, 7).map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            ) : (
              <EmptyGridState />
            )}
          </div>
        </section>

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

        {/* Newsletter signup */}
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

function EmptyGridState() {
  return (
    <div className="py-10 text-center">
      <p className="text-gray-400 text-base">
        Our first articles are coming soon. Subscribe to be notified.
      </p>
    </div>
  );
}
