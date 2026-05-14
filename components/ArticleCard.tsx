import Link from 'next/link';
import { Eye, Share2 } from 'lucide-react';
import { Article } from '@/lib/supabase';
import CategoryBadge from './CategoryBadge';
import { formatDate } from '@/lib/utils';
import { formatStatCount } from '@/lib/format-stats';
import { parseArticleShares } from '@/lib/article-shares';

type Props = {
  article: Article;
  variant?: 'default' | 'compact' | 'featured';
};

export default function ArticleCard({ article, variant = 'default' }: Props) {
  const href = `/articles/${article.slug}`;
  const viewCount = article.views ?? 0;
  const shareTotal = parseArticleShares(article.shares).total;

  if (variant === 'compact') {
    return (
      <div className="group relative flex gap-4 py-4 border-b border-gray-100 last:border-0">
        <Link href={href} className="absolute inset-0 z-10" aria-label={article.title} />
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
          <CategoryBadge category={article.category} label={article.label} linkable={false} />
          <h3
            className="mt-1 text-sm font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-blue-900 transition-colors"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            {article.title}
          </h3>
          <p className="mt-1 text-xs text-gray-400">{formatDate(article.published_at)}</p>
          <p className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-400">
            <span className="inline-flex items-center gap-1">
              <Eye size={12} strokeWidth={2} aria-hidden />
              {formatStatCount(viewCount)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Share2 size={12} strokeWidth={2} aria-hidden />
              {formatStatCount(shareTotal)}
            </span>
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'featured') {
    return (
      <div className="group relative">
        <Link href={href} className="absolute inset-0 z-10" aria-label={article.title} />
        {article.featured_image_url ? (
          <div className="relative w-full aspect-[16/9] overflow-hidden bg-gray-200 rounded-sm">
            <img
              src={article.featured_image_url}
              alt={article.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <CategoryBadge category={article.category} label={article.label} size="md" linkable={false} />
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
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-300 text-xs">
                {article.author_name && <span>{article.author_name}</span>}
                {article.author_name && <span>·</span>}
                <span>{formatDate(article.published_at)}</span>
                <span className="text-gray-400">·</span>
                <span className="inline-flex items-center gap-1 text-gray-400">
                  <Eye size={12} className="opacity-90" aria-hidden />
                  {formatStatCount(viewCount)}
                </span>
                <span className="inline-flex items-center gap-1 text-gray-400">
                  <Share2 size={12} className="opacity-90" aria-hidden />
                  {formatStatCount(shareTotal)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-gray-50 border border-gray-200 rounded-sm">
            <CategoryBadge category={article.category} label={article.label} size="md" linkable={false} />
            <h2
              className="mt-3 text-3xl font-bold text-gray-900 leading-tight group-hover:text-blue-900 transition-colors"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              {article.title}
            </h2>
            {article.subtitle && (
              <p className="mt-2 text-gray-600 text-base leading-relaxed">{article.subtitle}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-400 text-xs">
              {article.author_name && <span>{article.author_name}</span>}
              {article.author_name && <span>·</span>}
              <span>{formatDate(article.published_at)}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-gray-500">
                <Eye size={12} aria-hidden />
                {formatStatCount(viewCount)}
              </span>
              <span className="inline-flex items-center gap-1 text-gray-500">
                <Share2 size={12} aria-hidden />
                {formatStatCount(shareTotal)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // default card
  return (
    <div className="group relative">
      <Link href={href} className="absolute inset-0 z-10" aria-label={article.title} />
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
        <CategoryBadge category={article.category} label={article.label} linkable={false} />
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
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-400 text-xs font-sans">
          {article.author_name && <span className="font-medium text-gray-600">{article.author_name}</span>}
          {article.author_name && <span>·</span>}
          <span>{formatDate(article.published_at)}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Eye size={12} aria-hidden />
            {formatStatCount(viewCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Share2 size={12} aria-hidden />
            {formatStatCount(shareTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
