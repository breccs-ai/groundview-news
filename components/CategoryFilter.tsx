'use client';

import Link from 'next/link';
import { CATEGORIES } from '@/lib/supabase';

type Props = {
  active?: string;
};

export default function CategoryFilter({ active }: Props) {
  const inactiveClasses =
    'bg-gray-100 text-[#0f1f3d] border-gray-200 hover:bg-gray-200 hover:border-gray-300';
  const activeClasses = 'bg-gray-900 text-white border-gray-900';

  return (
    <div className="flex flex-wrap items-center gap-1.5 w-full max-w-full">
      <Link
        href="/"
        className={`px-4 py-2 text-sm font-medium rounded-sm border transition-colors duration-150 ${
          !active ? activeClasses : inactiveClasses
        }`}
      >
        All
      </Link>
      {CATEGORIES.map((cat) => (
        <Link
          key={cat.slug}
          href={`/category/${cat.slug}`}
          className={`px-4 py-2 text-sm font-medium rounded-sm border transition-colors duration-150 ${
            active === cat.slug ? activeClasses : inactiveClasses
          }`}
        >
          {cat.label}
        </Link>
      ))}
    </div>
  );
}
