export const dynamic = 'force-dynamic';
export const revalidate = 0;

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import AdminArticleEditFab from '@/components/AdminArticleEditFab';
import Footer from '@/components/Footer';
import CategoryBadge from '@/components/CategoryBadge';
import ArticleBodyRenderer from '@/components/ArticleBodyRenderer';
import AdSlot from '@/components/ads/AdSlot';
import ArticleCard from '@/components/ArticleCard';
import NewsletterSignup from '@/components/NewsletterSignup';
import ArticleReadersLine from '@/components/ArticleReadersLine';
import ArticleShareSection from '@/components/ArticleShareSection';
import SubscriptionPromptBanner from '@/components/SubscriptionPromptBanner';
import EarlyAccessBanner from '@/components/EarlyAccessBanner';
import { getArticleBySlug, getPublishedArticles } from '@/lib/supabase';
import { parseArticleShares } from '@/lib/article-shares';
import { formatDate } from '@/lib/utils';
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from '@/lib/admin-auth';

type Props = {
  params: { slug: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticleBySlug(params.slug);
  if (!article) return { title: 'Article not found | Ground View News' };

  return {
    title: `${article.title} | Ground View News`,
    description: article.excerpt || article.subtitle || '',
    openGraph: {
      title: article.title,
      description: article.excerpt || article.subtitle || '',
      type: 'article',
      publishedTime: article.published_at,
      authors: article.author_name ? [article.author_name] : undefined,
      images: article.featured_image_url ? [{ url: article.featured_image_url }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt || article.subtitle || '',
      images: article.featured_image_url ? [article.featured_image_url] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const article = await getArticleBySlug(params.slug);
  if (!article) notFound();

  const cookieStore = cookies();
  const showAdminEditFab =
    cookieStore.get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE;

  const sharesParsed = parseArticleShares(article.shares);

  const related = await getPublishedArticles({ category: article.category, limit: 4 });
  const relatedArticles = related.filter((a) => a.id !== article.id).slice(0, 3);

  return (
    <>
      <Navbar />

      <main className="bg-white">
        {/* Article header */}
        <div className="max-w-3xl mx-auto px-4 md:px-8 pt-10 pb-6">
          <div className="mb-4">
            <CategoryBadge category={article.category} label={article.label} size="md" />
          </div>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-4"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            {article.title}
          </h1>
          {article.subtitle && (
            <p className="text-lg sm:text-xl text-gray-600 leading-relaxed mb-6 font-light">
              {article.subtitle}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: '#0f1f3d' }}
                >
                  {article.author_name ? article.author_name[0].toUpperCase() : 'G'}
                </div>
                <div>
                  {article.author_name && (
                    <p className="text-sm font-semibold text-gray-900">{article.author_name}</p>
                  )}
                  <p className="text-xs text-gray-400">{formatDate(article.published_at)}</p>
                </div>
              </div>
              <ArticleReadersLine
                slug={article.slug}
                articleId={article.id}
                initialViews={article.views ?? 0}
              />
            </div>
          </div>
        </div>

        {/* Featured image */}
        {article.featured_image_url && (
          <div className="max-w-5xl mx-auto px-4 md:px-8 mb-8">
            <div className="w-full rounded-sm bg-gray-100">
              <img
                src={article.featured_image_url}
                alt={article.title}
                className="block w-auto max-w-full h-auto max-h-[60vh] sm:max-h-[640px] mx-auto rounded-sm"
              />
            </div>
          </div>
        )}

        {/* Article body + sidebar ads */}
        <div className="w-full max-w-[1280px] mx-auto px-4 md:px-8 pb-12">
          <div className="grid grid-cols-1 gap-8 lg:gap-10 lg:grid-cols-[240px_minmax(0,1fr)_240px]">
            {/* Left sidebar — desktop only, reserved for balance and rotated ads */}
            <aside className="hidden lg:block min-w-0">
              <AdSlot zone="article_sidebar" variant="sidebar" className="sticky top-24" />
            </aside>

            {/* Main content — centred, never exceeds 720px on desktop */}
            <div className="min-w-0 w-full mx-auto lg:max-w-[720px]">
              <EarlyAccessBanner publishAt={article.publish_at ?? null} />
              <ArticleBodyRenderer body={article.body} injectMidAd />

              <div className="mt-10 pt-6 border-t border-gray-100 space-y-6">
                <div>
                  <CategoryBadge category={article.category} label={article.label} />
                  {article.author_name && (
                    <p className="mt-2 text-xs text-gray-400">By {article.author_name}</p>
                  )}
                </div>
                <ArticleShareSection
                  slug={article.slug}
                  title={article.title}
                  initialShares={sharesParsed}
                />
              </div>
            </div>

            {/* Right sidebar — desktop only, matches left width */}
            <aside className="hidden lg:block min-w-0">
              <AdSlot zone="article_sidebar" variant="sidebar" className="sticky top-24" />
            </aside>
          </div>
        </div>

        {/* Article disclaimer */}
        <div className="max-w-3xl mx-auto px-4 md:px-8 pb-8">
          <div className="bg-gray-50 border border-gray-200 rounded-sm px-5 py-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong className="text-gray-600">Editorial note:</strong> This article represents
              the opinion and analysis of the author and does not constitute verified fact. Ground
              View News strives for accuracy and publishes corrections when errors are identified.{' '}
              <a
                href="/editorial-policy"
                className="underline hover:text-amber-700 transition-colors"
              >
                View our editorial policy
              </a>
              {' '}·{' '}
              <a
                href="/disclaimer"
                className="underline hover:text-amber-700 transition-colors"
              >
                Editorial disclaimer
              </a>
            </p>
          </div>
        </div>

        {/* Subscription prompt — non-blocking, dismissable, hidden for active subscribers */}
        <div className="max-w-3xl mx-auto px-4 md:px-8">
          <SubscriptionPromptBanner />
        </div>

        {/* Related articles */}
        {relatedArticles.length > 0 && (
          <section className="border-t border-gray-100 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
              <h2
                className="text-xl font-bold text-gray-900 mb-8"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                Related Articles
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-10">
                {relatedArticles.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Newsletter CTA */}
        <NewsletterSignup />
      </main>

      <Footer />

      {showAdminEditFab && <AdminArticleEditFab articleId={article.id} />}
    </>
  );
}
