import Link from 'next/link';
import { getCategoryMeta } from '@/lib/supabase';

type Props = {
  category: string;
  label?: string;
  linkable?: boolean;
  size?: 'sm' | 'md';
};

export default function CategoryBadge({ category, label, linkable = true, size = 'sm' }: Props) {
  const meta = getCategoryMeta(category);
  const displayLabel = label || meta.label;

  const classes = `inline-flex items-center font-sans font-semibold uppercase tracking-widest rounded-sm ${
    size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
  } ${meta.bg} ${meta.text}`;

  if (linkable) {
    return (
      <Link href={`/category/${category}`} className={`${classes} hover:opacity-80 transition-opacity`}>
        {displayLabel}
      </Link>
    );
  }

  return <span className={classes}>{displayLabel}</span>;
}
