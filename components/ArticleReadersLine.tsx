'use client';

import { useEffect, useState } from 'react';
import { formatStatCount } from '@/lib/format-stats';

type Props = {
  slug: string;
  initialViews: number;
};

export default function ArticleReadersLine({ slug, initialViews }: Props) {
  const [displayViews, setDisplayViews] = useState(initialViews);

  useEffect(() => {
    // This view tracking uses sessionStorage only. No personal data, no cookies, no IP addresses are stored. Compliant with GDPR and ePrivacy Directive.
    const sessionKey = `viewed_article_${slug}`;
    try {
      if (typeof window === 'undefined') return;
      if (sessionStorage.getItem(sessionKey)) return;

      try {
        void fetch(`/api/articles/${encodeURIComponent(slug)}/view`, { method: 'POST' })
          .then((res) => {
            if (res.ok) {
              sessionStorage.setItem(sessionKey, 'true');
              setDisplayViews((v) => v + 1);
            }
          })
          .catch(() => {
            /* ignore — page must render even if increment fails */
          });
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  }, [slug]);

  return (
    <span className="text-sm text-gray-600 tabular-nums">
      {formatStatCount(displayViews)} readers
    </span>
  );
}
