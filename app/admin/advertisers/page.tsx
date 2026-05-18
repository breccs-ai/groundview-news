'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import StatCard from '@/components/admin/StatCard';
import { formatDate } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

type AdRow = {
  id: string;
  title: string;
  tier: string;
  billing_cycle: string | null;
  status: string;
  expiry_date: string | null;
  view_count: number;
  click_count: number;
  expiring_within_7_days: boolean;
};

type Advertiser = {
  id: string;
  company_name: string;
  contact_email: string;
  current_tier: string;
  billing_cycle: string;
  ad_status: string;
  expiry_date: string | null;
  expiring_within_7_days: boolean;
  active_ad_count: number;
  total_views: number;
  total_clicks: number;
  ads: AdRow[];
};

function gbp(n: number) {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminAdvertisersPage() {
  const [revenue, setRevenue] = useState(0);
  const [rows, setRows] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    const res = await fetch(`/api/admin/advertisers-list?${params}`, { credentials: 'include' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setRevenue(Number(body.total_revenue_gbp) || 0);
      setRows((body.advertisers || []) as Advertiser[]);
    }
    setLoading(false);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
          Advertisers
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Accounts, placements, and ad performance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatCard label="Total advertising revenue" value={gbp(revenue)} hint="Sum of paid ad amounts (all time)" />
        <StatCard label="Advertiser accounts" value={rows.length} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          placeholder="Search company or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border border-gray-200 rounded-sm px-3 py-1.5 text-sm min-w-[220px]"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-sm hover:border-gray-400"
        >
          Search
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        {loading ? (
          <p className="p-8 text-sm text-gray-500 text-center">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-sm text-gray-500 text-center">No advertisers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Tier</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Billing</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-gray-500">Expires</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase text-gray-500">Views</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase text-gray-500">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <Fragment key={a.id}>
                    <tr
                      className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${a.expiring_within_7_days ? 'bg-amber-50/50' : ''}`}
                      onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {a.expiring_within_7_days && (
                          <AlertTriangle size={14} className="inline text-amber-700 mr-1" aria-hidden />
                        )}
                        {a.company_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{a.contact_email}</td>
                      <td className="px-4 py-3 capitalize">{a.current_tier}</td>
                      <td className="px-4 py-3">{a.billing_cycle}</td>
                      <td className="px-4 py-3">{a.ad_status}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {a.expiry_date ? formatDate(a.expiry_date) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{a.total_views}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{a.total_clicks}</td>
                    </tr>
                    {expanded === a.id && a.ads.length > 0 && (
                      <tr key={`${a.id}-detail`}>
                        <td colSpan={8} className="px-4 py-3 bg-gray-50">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Ads ({a.active_ad_count} active)</p>
                          <ul className="space-y-1 text-xs text-gray-700">
                            {a.ads.map((ad) => (
                              <li key={ad.id} className="flex flex-wrap gap-x-3 gap-y-1">
                                <span className="font-medium">{ad.title}</span>
                                <span>{ad.status}</span>
                                <span>{ad.view_count} views</span>
                                <span>{ad.click_count} clicks</span>
                                {ad.expiring_within_7_days && (
                                  <span className="text-amber-800 font-medium">Expires soon</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
