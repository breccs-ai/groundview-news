'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import StatCard from '@/components/admin/StatCard';
import SimpleBarChart from '@/components/admin/SimpleBarChart';
import { formatDate } from '@/lib/utils';

type Subscriber = {
  id: string;
  email: string;
  tier: 'monthly' | 'annual' | 'newsletter';
  status: 'active' | 'cancelled' | 'past_due' | 'pending' | 'free';
  join_date: string;
  expires_at: string | null;
};

type ApiResponse = {
  total: number;
  free_newsletter_count: number;
  active_paid_count: number;
  monthly_paid_count: number;
  annual_paid_count: number;
  mrr_pence: number;
  subscribers: Subscriber[];
  monthly_growth: Array<{ month: string; count: number }>;
};

function formatGBPFromPence(pence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

function planLabel(tier: Subscriber['tier']): string {
  if (tier === 'monthly') return 'Monthly';
  if (tier === 'annual') return 'Annual';
  return 'Free';
}

function statusLabel(status: Subscriber['status']): string {
  if (status === 'active') return 'Active';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'past_due') return 'Past due';
  if (status === 'pending') return 'Pending';
  return 'Free';
}

function statusBadgeClass(status: Subscriber['status']): string {
  switch (status) {
    case 'active':
      return 'bg-green-50 text-green-800';
    case 'past_due':
      return 'bg-red-50 text-red-800';
    case 'cancelled':
      return 'bg-gray-100 text-gray-700';
    case 'pending':
      return 'bg-amber-50 text-amber-900';
    default:
      return 'bg-gray-50 text-gray-600';
  }
}

export default function AdminSubscribersPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
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
    const body = (await res.json().catch(() => ({}))) as Partial<ApiResponse>;
    if (res.ok) {
      setData({
        total: Number(body.total) || 0,
        free_newsletter_count: Number(body.free_newsletter_count) || 0,
        active_paid_count: Number(body.active_paid_count) || 0,
        monthly_paid_count: Number(body.monthly_paid_count) || 0,
        annual_paid_count: Number(body.annual_paid_count) || 0,
        mrr_pence: Number(body.mrr_pence) || 0,
        subscribers: (body.subscribers || []) as Subscriber[],
        monthly_growth: (body.monthly_growth || []) as Array<{ month: string; count: number }>,
      });
    }
    setLoading(false);
  }, [tierFilter, statusFilter, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const growthChart = (data?.monthly_growth || []).map((g) => ({
    label: g.month,
    value: g.count,
  }));

  const rows = data?.subscribers || [];

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
          Subscribers
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Newsletter signups, paid subscribers, and growth</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total subscribers" value={data?.total ?? 0} />
        <StatCard label="Active paid subscribers" value={data?.active_paid_count ?? 0} />
        <StatCard label="MRR estimate" value={formatGBPFromPence(data?.mrr_pence ?? 0)} />
        <StatCard label="Free newsletter" value={data?.free_newsletter_count ?? 0} />
      </div>

      <div className="mb-8">
        <SimpleBarChart title="New newsletter signups per month" items={growthChart} />
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
          <option value="all">All plans</option>
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
          <option value="newsletter">Newsletter (free)</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-sm px-2 py-1.5 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
          <option value="past_due">Past due</option>
          <option value="pending">Pending</option>
          <option value="free">Free</option>
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
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Expiry</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={`${s.tier}-${s.id}`} className="border-b border-gray-100">
                    <td className="px-4 py-3 break-all">{s.email}</td>
                    <td className="px-4 py-3">{planLabel(s.tier)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${statusBadgeClass(s.status)}`}
                      >
                        {statusLabel(s.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {s.expires_at ? formatDate(s.expires_at) : '—'}
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
