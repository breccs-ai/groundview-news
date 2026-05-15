'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import CategoryBadge from '@/components/CategoryBadge';
import type { Article } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { Eye, Share2 } from 'lucide-react';
import { formatStatCount } from '@/lib/format-stats';
import { parseArticleShares } from '@/lib/article-shares';

const ROTATION_MS = 900_000;
const FADE_MS = 400;

type Props = {
  articles: Article[];
};

export default function FeaturedArticleHero({ articles }: Props) {
  const count = articles.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);

  const featured = articles[activeIndex];
  const canRotate = count > 1;

  const selectArticle = useCallback(
    (index: number) => {
      setPaused(true);
      if (index === activeIndex) return;
      setVisible(false);
      window.setTimeout(() => {
        setActiveIndex(index);
        setVisible(true);
      }, FADE_MS);
    },
    [activeIndex],
  );

  const advance = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => {
      setActiveIndex((i) => (i + 1) % count);
      setVisible(true);
    }, FADE_MS);
  }, [count]);

  useEffect(() => {
    if (!canRotate || paused) return;
    const id = window.setInterval(advance, ROTATION_MS);
    return () => window.clearInterval(id);
  }, [canRotate, paused, advance]);

  if (!featured) return null;

  return (
    <section className="bg-white border-b border-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-12">
        <article
          className={`transition-opacity duration-500 ease-in-out ${visible ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setPaused(true)}
          role={canRotate ? 'group' : undefined}
        >
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

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            {featured.author_name && (
              <>
                <span className="font-medium text-gray-700">{featured.author_name}</span>
                <span className="text-gray-300">·</span>
              </>
            )}
            <span>{formatDate(featured.published_at)}</span>
            <span className="text-gray-300">·</span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <Eye size={14} aria-hidden />
              {formatStatCount(featured.views ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <Share2 size={14} aria-hidden />
              {formatStatCount(parseArticleShares(featured.shares).total)}
            </span>
          </div>

          {featured.excerpt && (
            <p className="mt-5 text-base text-gray-700 leading-relaxed border-t border-gray-100 pt-5">
              {featured.excerpt}
            </p>
          )}

          <div className="mt-7">
            <Link
              href={`/articles/${featured.slug}`}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-sm transition-colors"
              style={{ backgroundColor: '#B8860B', color: '#fff' }}
              onClick={(e) => e.stopPropagation()}
            >
              Read Full Article →
            </Link>
          </div>
        </article>

        {canRotate && (
          <div className="mt-8 flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-2 flex-wrap" role="tablist" aria-label="Featured articles">
              {articles.map((article, i) => (
                <button
                  key={article.id}
                  type="button"
                  role="tab"
                  aria-selected={i === activeIndex}
                  aria-label={`Show featured: ${article.title}`}
                  onClick={() => selectArticle(i)}
                  className="group p-1 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                >
                  <span
                    className={`block h-2.5 w-2.5 rounded-full transition-colors ${
                      i === activeIndex ? 'bg-[#B8860B] scale-110' : 'bg-gray-300 group-hover:bg-gray-400'
                    }`}
                  />
                </button>
              ))}
            </div>
            {!paused && (
              <div className="h-0.5 w-32 sm:w-40 bg-gray-200 rounded-full overflow-hidden" aria-hidden>
                <div
                  key={`progress-${activeIndex}`}
                  className="h-full bg-[#B8860B]/70 rounded-full featured-hero-progress-bar"
                  style={{ animationDuration: `${ROTATION_MS}ms` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
