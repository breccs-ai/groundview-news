'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import StatCard from '@/components/admin/StatCard';
import { formatDate } from '@/lib/utils';

type Journalist = {
  id: string;
  name: string;
  email: string;
  join_date: string;
  subscription_tier: string;
  status: string;
  article_count: number;
  total_views: number;
  this_month_accruing_gbp: number;
  last_month_settled_gbp: number;
};

type MonthSummary = {
  start: string;
  end: string;
  total_ad_revenue_gbp: number;
  net_revenue_gbp: number;
  journalist_pool_gbp: number;
  total_owed_gbp: number;
};

function gbp(n: number) {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function MonthSummaryBlock({
  title,
  month,
  sharePercent,
}: {
  title: string;
  month: MonthSummary;
  sharePercent: number;
}) {
  return (
    <div className="p-5 bg-white border border-gray-200 rounded-sm">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">{title}</h2>
      <p className="text-xs text-gray-500 mb-4">
        {formatDate(month.start)} — {formatDate(month.end)} · {sharePercent}% of net ad revenue to journalists
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Ad revenue" value={gbp(month.total_ad_revenue_gbp)} />
        <StatCard label="Net revenue" value={gbp(month.net_revenue_gbp)} />
        <StatCard label="Journalist pool" value={gbp(month.journalist_pool_gbp)} />
        <StatCard label="Total owed" value={gbp(month.total_owed_gbp)} />
      </div>
    </div>
  );
}

export default function AdminJournalistsPage() {
  const [journalists, setJournalists] = useState<Journalist[]>([]);
  const [thisMonth, setThisMonth] = useState<MonthSummary | null>(null);
  const [lastMonth, setLastMonth] = useState<MonthSummary | null>(null);
  const [sharePercent, setSharePercent] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch('/api/admin/journalists', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setJournalists((body.journalists || []) as Journalist[]);
        setThisMonth((body.this_month || null) as MonthSummary | null);
        setLastMonth((body.last_month || null) as MonthSummary | null);
        setSharePercent(Number(body.share_percent) || 30);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
          Journalists
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Contributors, readership, and monthly revenue share</p>
      </div>

      {thisMonth && lastMonth && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <MonthSummaryBlock title="This month (accruing)" month={thisMonth} sharePercent={sharePercent} />
          <MonthSummaryBlock title="Last month (settled)" month={lastMonth} sharePercent={sharePercent} />
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        {loading ? (
          <p className="p-8 text-sm text-gray-500 text-center">Loading…</p>
        ) : journalists.length === 0 ? (
          <p className="p-8 text-sm text-gray-500 text-center">No journalist accounts found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Tier</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase text-gray-500">Articles</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase text-gray-500">Total views</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase text-gray-500 whitespace-nowrap">
                    This month (accruing)
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase text-gray-500 whitespace-nowrap">
                    Last month (settled)
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Joined</th>
                </tr>
              </thead>
              <tbody>
                {journalists.map((j) => (
                  <tr key={j.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{j.name}</td>
                    <td className="px-4 py-3 text-gray-600">{j.email}</td>
                    <td className="px-4 py-3 capitalize">{j.subscription_tier}</td>
                    <td className="px-4 py-3">{j.status}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{j.article_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{j.total_views.toLocaleString('en-GB')}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-amber-900">
                      {gbp(j.this_month_accruing_gbp)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-800">
                      {gbp(j.last_month_settled_gbp)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(j.join_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
