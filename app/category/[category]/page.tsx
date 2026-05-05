import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ArticleCard from '@/components/ArticleCard';
import CategoryFilter from '@/components/CategoryFilter';
import NewsletterSignup from '@/components/NewsletterSignup';
import { getPublishedArticles, getCategoryMeta, CATEGORIES } from '@/lib/supabase';

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

export const dynamic = 'force-dynamic';

export default async function CategoryPage({ params }: Props) {
  const { category } = params;
  const meta = getCategoryMeta(category);
  const articles = await getPublishedArticles({ category });

  return (
    <>
      <Navbar />

      <main className="bg-white">
        {/* Page header */}
        <div style={{ backgroundColor: '#0f1f3d' }} className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <CategoryFilter active={category} />
          </div>
        </div>

        {/* Article grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          {articles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p
                className="text-2xl font-bold text-gray-200 mb-3"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                {meta.label}
              </p>
              <p className="text-gray-500 text-base">
                Our first articles are coming soon. Subscribe to be notified.
              </p>
            </div>
          )}
        </div>

        <NewsletterSignup />
      </main>

      <Footer />
    </>
  );
}
