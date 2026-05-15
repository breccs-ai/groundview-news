export const dynamic = 'force-dynamic';
export const revalidate = 0;

import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CategoryBadge from '@/components/CategoryBadge';
import CategoryFilter from '@/components/CategoryFilter';
import FeaturedArticleHero from '@/components/FeaturedArticleHero';
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
};

export default async function HomePage() {
  const articles = await getPublishedArticles();

  const featuredArticles = articles.slice(0, Math.min(5, articles.length));
  const secondary = articles.slice(1);

  return (
    <>
      <Navbar />

      <main>
        {featuredArticles.length > 0 && <FeaturedArticleHero articles={featuredArticles} />}

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
