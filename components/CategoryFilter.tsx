'use client';

import Link from 'next/link';
import { CATEGORIES } from '@/lib/supabase';

type Props = {
  active?: string;
};

export default function CategoryFilter({ active }: Props) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
      <Link
        href="/"
        className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-sm border transition-colors duration-150 ${
          !active
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
        }`}
      >
        All
      </Link>
      {CATEGORIES.map((cat) => (
        <Link
          key={cat.slug}
          href={`/category/${cat.slug}`}
          className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-sm border transition-colors duration-150 ${
            active === cat.slug
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
          }`}
        >
          {cat.label}
        </Link>
      ))}
    </div>
  );
}
