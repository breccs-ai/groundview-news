export const dynamic = 'force-dynamic';
export const revalidate = 0;

import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CategoryBadge from '@/components/CategoryBadge';
import CategoryFilter from '@/components/CategoryFilter';
import FeaturedArticleHero from '@/components/FeaturedArticleHero';
import AdSlot from '@/components/ads/AdSlot';
import NewsletterSignup from '@/components/NewsletterSignup';
import { getPublishedArticles } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { Eye, Share2 } from 'lucide-react';
import { formatStatCount } from '@/lib/format-stats';
import { parseArticleShares } from '@/lib/article-shares';

export const metadata: Metadata = {
  title: 'Ground View News: Independent Global Commentary',
  description:
    'Independent commentary on global affairs: Africa, the African diaspora, human rights, world politics, and the global economy.',
  alternates: {
    canonical: '/',
  },
};

export default async function HomePage() {
  const articles = await getPublishedArticles();

  const featuredArticles = articles.slice(0, Math.min(5, articles.length));
  const secondary = articles.slice(1);

  return (
    <>
      <Navbar />

      <main>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <AdSlot zone="homepage_featured" variant="featured" className="mb-6" />
        </div>

        {featuredArticles.length > 0 && <FeaturedArticleHero articles={featuredArticles} />}

        {secondary.length > 0 && (
          <section className="bg-white">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10">
              <div>
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
                        <Link href={`/articles/${article.slug}`}>{article.title}</Link>
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        {article.author_name && (
                          <>
                            <span className="font-medium text-gray-600">{article.author_name}</span>
                            <span className="text-gray-300">·</span>
                          </>
                        )}
                        <span>{formatDate(article.published_at)}</span>
                        <span className="text-gray-300">·</span>
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <Eye size={12} aria-hidden />
                          {formatStatCount(article.views ?? 0)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <Share2 size={12} aria-hidden />
                          {formatStatCount(parseArticleShares(article.shares).total)}
                        </span>
                      </div>
                      {article.excerpt && (
                        <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-2">
                          {article.excerpt}
                        </p>
                      )}
                      <Link
                        href={`/articles/${article.slug}`}
                        className="mt-3 inline-flex items-center text-sm font-semibold transition-colors"
                        style={{ color: '#B8860B' }}
                      >
                        Read More →
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
              <aside className="hidden lg:block">
                <AdSlot zone="homepage_sidebar" variant="sidebar" className="sticky top-24" />
              </aside>
            </div>
          </section>
        )}

        <div style={{ backgroundColor: '#0f1f3d' }} className="py-8">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
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
