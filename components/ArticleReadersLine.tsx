'use client';

import { useEffect, useState } from 'react';
import { formatStatCount } from '@/lib/format-stats';

type Props = {
  slug: string;
  articleId: string;
  initialViews: number;
};

function getOrCreateSessionId(): string {
  const key = 'gvn_reader_session';
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = `rs_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return `rs_${Date.now()}`;
  }
}

export default function ArticleReadersLine({ slug, articleId, initialViews }: Props) {
  const [displayViews, setDisplayViews] = useState(initialViews);

  useEffect(() => {
    const sessionKey = `viewed_article_${slug}`;
    try {
      if (typeof window === 'undefined') return;
      if (sessionStorage.getItem(sessionKey)) return;

      const sessionId = getOrCreateSessionId();
      const referrer = typeof document !== 'undefined' ? document.referrer : '';

      void fetch(`/api/articles/${encodeURIComponent(slug)}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, referrer }),
      })
        .then((res) => {
          if (res.ok) {
            sessionStorage.setItem(sessionKey, 'true');
            setDisplayViews((v) => v + 1);
          }
        })
        .catch(() => {
          /* ignore */
        });
    } catch {
      /* ignore */
    }
  }, [slug, articleId]);

  return (
    <span className="text-sm text-gray-600 tabular-nums">
      {formatStatCount(displayViews)} readers
    </span>
  );
}
