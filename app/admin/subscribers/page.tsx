'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import StatCard from '@/components/admin/StatCard';
import SimpleBarChart from '@/components/admin/SimpleBarChart';
import { formatDate } from '@/lib/utils';

type Subscriber = {
  id: string;
  email: string;
  tier: string;
  status: string;
  join_date: string;
};

export default function AdminSubscribersPage() {
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [growth, setGrowth] = useState<Array<{ month: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tierFilter !== 'all') params.set('tier', tierFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (q.trim()) params.set('q', q.trim());
    const res = await fetch(`/api/admin/subscribers?${params}`, { credentials: 'include' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setTotal(Number(body.total) || 0);
      setRows((body.subscribers || []) as Subscriber[]);
      setGrowth((body.monthly_growth || []) as Array<{ month: string; count: number }>);
    }
    setLoading(false);
  }, [tierFilter, statusFilter, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const growthChart = growth.map((g) => ({
    label: g.month,
    value: g.count,
  }));

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
          Subscribers
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Newsletter subscribers and growth</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatCard label="Total subscribers" value={total} />
      </div>

      <div className="mb-8">
        <SimpleBarChart title="New subscribers per month" items={growthChart} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          placeholder="Search email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border border-gray-200 rounded-sm px-3 py-1.5 text-sm min-w-[200px]"
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="border border-gray-200 rounded-sm px-2 py-1.5 text-sm"
        >
          <option value="all">All tiers</option>
          <option value="newsletter">Newsletter</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-sm px-2 py-1.5 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-sm hover:border-gray-400"
        >
          Apply
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        {loading ? (
          <p className="p-8 text-sm text-gray-500 text-center">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-sm text-gray-500 text-center">No subscribers match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Tier</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="px-4 py-3">{s.email}</td>
                    <td className="px-4 py-3 capitalize">{s.tier}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${
                          s.status === 'active' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(s.join_date)}</td>
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
