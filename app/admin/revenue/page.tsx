'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';

type ShareRow = {
  id: string;
  journalist_id: string;
  amount_earned: number;
  view_share: number;
  weighted_views: number;
  status: string;
  created_at: string;
};

export default function AdminRevenuePage() {
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('journalist_revenue_shares')
        .select('id, journalist_id, amount_earned, view_share, weighted_views, status, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        setRows((data as ShareRow[]) || []);
      }
      setLoading(false);
    })();
  }, []);

  const totals = useMemo(() => {
    const total = rows.reduce((s, r) => s + (Number(r.amount_earned) || 0), 0);
    return { total };
  }, [rows]);

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
          Revenue Shares
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Latest calculated journalist revenue shares.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-sm text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mb-4 text-sm text-gray-700">
        <span className="font-semibold">Total (shown rows):</span> {formatGBP(totals.total)}
      </div>

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">No revenue shares found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Journalist</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Weighted views</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Share</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.journalist_id}</td>
                    <td className="px-4 py-3">{Number(r.weighted_views || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">{Math.round((Number(r.view_share || 0) * 10000)) / 100}%</td>
                    <td className="px-4 py-3 font-semibold">{formatGBP(Number(r.amount_earned) || 0)}</td>
                    <td className="px-4 py-3 capitalize">{r.status}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(r.created_at)}</td>
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

function formatGBP(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

