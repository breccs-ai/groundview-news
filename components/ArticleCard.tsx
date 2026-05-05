import Link from 'next/link';
import Image from 'next/image';
import { Article } from '@/lib/supabase';
import CategoryBadge from './CategoryBadge';
import { formatDate } from '@/lib/utils';

type Props = {
  article: Article;
  variant?: 'default' | 'compact' | 'featured';
};

export default function ArticleCard({ article, variant = 'default' }: Props) {
  if (variant === 'compact') {
    return (
      <Link href={`/article/${article.slug}`} className="group flex gap-4 py-4 border-b border-gray-100 last:border-0 hover:opacity-90 transition-opacity">
        {article.featured_image_url && (
          <div className="flex-shrink-0 w-20 h-20 rounded overflow-hidden bg-gray-100">
            <img
              src={article.featured_image_url}
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <CategoryBadge category={article.category} label={article.label} />
          <h3
            className="mt-1 text-sm font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-blue-900 transition-colors"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            {article.title}
          </h3>
          <p className="mt-1 text-xs text-gray-400">{formatDate(article.published_at)}</p>
        </div>
      </Link>
    );
  }

  if (variant === 'featured') {
    return (
      <Link href={`/article/${article.slug}`} className="group block">
        {article.featured_image_url && (
          <div className="relative w-full aspect-[16/9] overflow-hidden bg-gray-200 rounded-sm">
            <img
              src={article.featured_image_url}
              alt={article.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <CategoryBadge category={article.category} label={article.label} size="md" />
              <h2
                className="mt-2 text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                {article.title}
              </h2>
              {article.subtitle && (
                <p className="mt-2 text-gray-200 text-sm md:text-base leading-relaxed line-clamp-2">
                  {article.subtitle}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3 text-gray-300 text-xs">
                {article.author_name && <span>{article.author_name}</span>}
                {article.author_name && <span>·</span>}
                <span>{formatDate(article.published_at)}</span>
              </div>
            </div>
          </div>
        )}
        {!article.featured_image_url && (
          <div className="p-6 bg-gray-50 border border-gray-200 rounded-sm">
            <CategoryBadge category={article.category} label={article.label} size="md" />
            <h2
              className="mt-3 text-3xl font-bold text-gray-900 leading-tight group-hover:text-blue-900 transition-colors"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              {article.title}
            </h2>
            {article.subtitle && (
              <p className="mt-2 text-gray-600 text-base leading-relaxed">{article.subtitle}</p>
            )}
            <div className="mt-3 flex items-center gap-3 text-gray-400 text-xs">
              {article.author_name && <span>{article.author_name}</span>}
              {article.author_name && <span>·</span>}
              <span>{formatDate(article.published_at)}</span>
            </div>
          </div>
        )}
      </Link>
    );
  }

  // default card
  return (
    <Link href={`/article/${article.slug}`} className="group block">
      {article.featured_image_url && (
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-gray-200 rounded-sm mb-4">
          <img
            src={article.featured_image_url}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      )}
      <div className={article.featured_image_url ? '' : 'pt-4 border-t-2 border-gray-900'}>
        <CategoryBadge category={article.category} label={article.label} />
        <h3
          className="mt-2 text-xl font-bold text-gray-900 leading-snug line-clamp-3 group-hover:text-blue-900 transition-colors"
          style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
        >
          {article.title}
        </h3>
        {article.subtitle && (
          <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-2">
            {article.subtitle}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3 text-gray-400 text-xs font-sans">
          {article.author_name && <span className="font-medium text-gray-600">{article.author_name}</span>}
          {article.author_name && <span>·</span>}
          <span>{formatDate(article.published_at)}</span>
        </div>
      </div>
    </Link>
  );
}
