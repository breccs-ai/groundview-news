'use client';

import type { ActiveAd } from '@/lib/advertiser/active-ads';

type Props = {
  ad: ActiveAd;
  variant?: 'featured' | 'sidebar' | 'inline' | 'footer';
  onClick?: (adId: string) => void;
};

export default function AdBanner({ ad, variant = 'sidebar', onClick }: Props) {
  const isFeatured = variant === 'featured';
  const isFooter = variant === 'footer';

  return (
    <aside
      className={
        isFeatured
          ? 'rounded-sm border border-amber-200/60 bg-gradient-to-br from-[#0f1f3d] to-[#1a3058] p-6 text-white shadow-md'
          : isFooter
            ? 'rounded-sm border border-gray-700 bg-[#152a4a] px-4 py-3 text-white'
            : 'rounded-sm border border-gray-200 bg-gray-50 p-4'
      }
      aria-label="Advertisement"
      data-ad-id={ad.id}
    >
      <p
        className={`text-[10px] uppercase tracking-widest mb-2 ${
          isFeatured || isFooter ? 'text-amber-300/90' : 'text-gray-400'
        }`}
      >
        Sponsored
      </p>
      <a
        href={ad.destination_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block group"
        onClick={() => onClick?.(ad.id)}
      >
        {ad.image_url && (
          <div
            className={
              isFeatured
                ? 'mb-4 aspect-[21/9] overflow-hidden rounded-sm bg-white/10'
                : 'mb-3 aspect-[16/9] overflow-hidden rounded-sm bg-white'
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ad.image_url}
              alt=""
              className="h-full w-full object-cover group-hover:opacity-95 transition-opacity"
            />
          </div>
        )}
        <h3
          className={`font-semibold leading-snug group-hover:underline ${
            isFeatured ? 'text-xl text-white' : isFooter ? 'text-sm text-white' : 'text-base text-gray-900'
          }`}
          style={isFeatured ? { fontFamily: 'Playfair Display, Georgia, serif' } : undefined}
        >
          {ad.title}
        </h3>
        {ad.body_text && (
          <p
            className={`mt-1 text-sm leading-relaxed line-clamp-2 ${
              isFeatured || isFooter ? 'text-gray-300' : 'text-gray-600'
            }`}
          >
            {ad.body_text}
          </p>
        )}
      </a>
    </aside>
  );
}
