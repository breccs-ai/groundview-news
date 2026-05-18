'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import StatCard from '@/components/admin/StatCard';
import SimpleBarChart from '@/components/admin/SimpleBarChart';
import { formatStatCount } from '@/lib/format-stats';

type Metrics = {
  readership: {
    unique_readers: number;
    total_view_events: number;
    total_article_views: number;
    top_articles: Array<{
      id: string;
      title: string;
      category: string;
      view_count: number;
    }>;
    best_category: { label: string; views: number };
  };
  traffic: {
    sources: Array<{ label: string; value: number }>;
    social_platforms: Array<{ label: string; value: number }>;
  };
  sharing: {
    total_shares: number;
    by_channel: Array<{ label: string; value: number }>;
  };
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch('/api/admin/metrics', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Failed to load metrics');
        setData(null);
      } else {
        setData(body as Metrics);
        setError(null);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <AdminShell>
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
        >
          Overview
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">All-time readership, traffic, and sharing metrics</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-sm text-sm text-red-800">{error}</div>
      )}

      {loading && <p className="text-sm text-gray-500">Loading metrics…</p>}

      {data && !loading && (
        <div className="space-y-10">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">Readership</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="Unique readers" value={formatStatCount(data.readership.unique_readers)} hint="Distinct sessions in article_views" />
              <StatCard label="Total article views" value={formatStatCount(data.readership.total_article_views)} hint="Published article view counters" />
              <StatCard label="Tracked view events" value={formatStatCount(data.readership.total_view_events)} hint="Row-level article_views records" />
              <StatCard
                label="Best category"
                value={data.readership.best_category.label}
                hint={`${formatStatCount(data.readership.best_category.views)} views`}
              />
            </div>

            <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
              <h3 className="px-4 py-3 text-sm font-semibold text-gray-900 border-b border-gray-100">
                Most read articles (top 10)
              </h3>
              {data.readership.top_articles.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">No published articles yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-gray-500">Title</th>
                        <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-gray-500">Category</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold uppercase text-gray-500">Views</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.readership.top_articles.map((a, i) => (
                        <tr key={a.id} className="border-b border-gray-100">
                          <td className="px-4 py-3 text-gray-900">
                            <span className="text-gray-400 mr-2">{i + 1}.</span>
                            {a.title}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{a.category}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">{formatStatCount(a.view_count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SimpleBarChart title="Traffic sources" items={data.traffic.sources} emptyMessage="Referrer data will appear as readers visit articles." />
            <SimpleBarChart
              title="Social platforms"
              items={data.traffic.social_platforms}
              emptyMessage="Social referrers appear when readers arrive from social links."
            />
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">Sharing</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <StatCard label="Total shares" value={formatStatCount(data.sharing.total_shares)} />
            </div>
            <SimpleBarChart
              title="Shares by channel"
              items={data.sharing.by_channel}
              emptyMessage="Share clicks are recorded when readers use the share buttons."
            />
          </section>
        </div>
      )}
    </AdminShell>
  );
}
