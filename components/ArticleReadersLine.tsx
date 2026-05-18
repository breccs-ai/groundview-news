'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatStatCount } from '@/lib/format-stats';
type Props = {
  slug: string;
  articleId: string;
  initialViews: number;
};

const SESSION_KEY = 'gvn_reader_session';

export function getOrCreateReaderSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = `rs_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `rs_${Date.now()}`;
  }
}

export default function ArticleReadersLine({ slug, articleId, initialViews }: Props) {
  const [displayViews, setDisplayViews] = useState(initialViews);

  const refreshFromDb = useCallback(async () => {
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(slug)}/metrics`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const body = (await res.json()) as { views?: number };
      if (typeof body.views === 'number' && Number.isFinite(body.views)) {
        setDisplayViews(body.views);
      }
    } catch {
      /* ignore */
    }
  }, [slug]);

  useEffect(() => {
    void refreshFromDb();
  }, [refreshFromDb, initialViews]);

  useEffect(() => {
    const viewedKey = `viewed_article_${slug}`;
    try {
      if (typeof window === 'undefined') return;

      const sessionId = getOrCreateReaderSessionId();
      const referrer = document.referrer || '';

      void fetch(`/api/articles/${encodeURIComponent(slug)}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, referrer }),
      })
        .then(async (res) => {
          const body = (await res.json().catch(() => ({}))) as {
            views?: number;
            recorded?: boolean;
          };
          if (res.ok && typeof body.views === 'number') {
            setDisplayViews(body.views);
            if (body.recorded !== false) {
              sessionStorage.setItem(viewedKey, 'true');
            }
          } else if (sessionStorage.getItem(viewedKey)) {
            void refreshFromDb();
          }
        })
        .catch(() => {
          void refreshFromDb();
        });
    } catch {
      /* ignore */
    }
  }, [slug, articleId, refreshFromDb]);

  return (
    <span className="text-sm text-gray-600 tabular-nums">
      {formatStatCount(displayViews)} readers
    </span>
  );
}
