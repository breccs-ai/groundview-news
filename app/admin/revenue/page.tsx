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

type PaymentRow = {
  id: string;
  journalist_id: string;
  amount: number;
  currency: string;
  status: string;
  writer_note: string | null;
  admin_note: string | null;
  transaction_reference: string | null;
  requested_at: string;
  writer: { full_name: string; pen_name: string | null; email: string } | null;
  payout_profile: {
    payment_method: string;
    recipient_name: string;
    country: string;
    currency: string;
    service_name: string | null;
    payment_details: string;
  } | null;
};

type PaymentEdit = { status: string; reference: string; note: string };

export default function AdminRevenuePage() {
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentEdits, setPaymentEdits] = useState<Record<string, PaymentEdit>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadPayments = async () => {
    const res = await fetch('/api/admin/writer-payments', { credentials: 'include' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || 'Could not load payment requests.');
      return;
    }
    const next = (body.rows || []) as PaymentRow[];
    setPayments(next);
    setPaymentEdits(Object.fromEntries(next.map((row) => [row.id, {
      status: nextStatusOptions(row.status)[0] || row.status,
      reference: row.transaction_reference || '',
      note: row.admin_note || '',
    }])));
  };

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
      await loadPayments();
    })();
  }, []);

  const updatePayment = async (id: string) => {
    const edit = paymentEdits[id];
    if (!edit) return;
    setUpdatingId(id);
    setError(null);
    const res = await fetch('/api/admin/writer-payments', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        status: edit.status,
        transaction_reference: edit.reference,
        admin_note: edit.note,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setError(body.error || 'Could not update payment request.');
    else await loadPayments();
    setUpdatingId(null);
  };

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

      <section className="mb-10 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Writer payment requests</h2>
          <p className="text-sm text-gray-500">Manual remittances using the writer&apos;s saved payout instructions.</p>
        </div>
        {payments.length === 0 ? (
          <div className="p-6 bg-white border border-gray-200 text-sm text-gray-500">No payment requests.</div>
        ) : payments.map((payment) => {
          const edit = paymentEdits[payment.id] || { status: '', reference: '', note: '' };
          const options = nextStatusOptions(payment.status);
          return (
            <article key={payment.id} className="bg-white border border-gray-200 p-5 rounded-sm grid lg:grid-cols-3 gap-5 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Writer</p>
                <p className="font-semibold text-gray-900 mt-1">{payment.writer?.pen_name || payment.writer?.full_name || payment.journalist_id}</p>
                <p className="text-gray-600">{payment.writer?.email}</p>
                <p className="mt-3 text-2xl font-bold">{formatCurrency(payment.amount, payment.currency)}</p>
                <p className="capitalize text-gray-600">{payment.status} · {formatDate(payment.requested_at)}</p>
                {payment.writer_note && <p className="mt-2 p-2 bg-gray-50 text-gray-700">Writer note: {payment.writer_note}</p>}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Remittance instructions</p>
                {payment.payout_profile ? (
                  <div className="mt-2 space-y-1">
                    <p><strong>Method:</strong> {payment.payout_profile.payment_method.replaceAll('_', ' ')}</p>
                    <p><strong>Recipient:</strong> {payment.payout_profile.recipient_name}</p>
                    <p><strong>Location:</strong> {payment.payout_profile.country}</p>
                    <p><strong>Preferred currency:</strong> {payment.payout_profile.currency}</p>
                    {payment.payout_profile.service_name && <p><strong>Service:</strong> {payment.payout_profile.service_name}</p>}
                    <p className="mt-2 p-3 bg-amber-50 border border-amber-100 whitespace-pre-wrap break-words">{payment.payout_profile.payment_details}</p>
                  </div>
                ) : <p className="mt-2 text-red-700">No payout profile is available.</p>}
              </div>
              <div className="space-y-3">
                {options.length > 0 ? (
                  <>
                    <label className="block"><span className="text-xs font-semibold text-gray-600">Next status</span><select className="mt-1 w-full border border-gray-300 p-2" value={edit.status} onChange={(e) => setPaymentEdits((all) => ({ ...all, [payment.id]: { ...edit, status: e.target.value } }))}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                    <label className="block"><span className="text-xs font-semibold text-gray-600">Transaction reference (required for paid)</span><input className="mt-1 w-full border border-gray-300 p-2" value={edit.reference} onChange={(e) => setPaymentEdits((all) => ({ ...all, [payment.id]: { ...edit, reference: e.target.value } }))} /></label>
                    <label className="block"><span className="text-xs font-semibold text-gray-600">Note to writer</span><textarea rows={3} className="mt-1 w-full border border-gray-300 p-2" value={edit.note} onChange={(e) => setPaymentEdits((all) => ({ ...all, [payment.id]: { ...edit, note: e.target.value } }))} /></label>
                    <button disabled={updatingId === payment.id} onClick={() => void updatePayment(payment.id)} className="px-4 py-2 bg-[#0f1f3d] text-white font-semibold disabled:opacity-50">Update request</button>
                  </>
                ) : (
                  <div className="p-3 bg-gray-50"><p className="font-semibold capitalize">{payment.status}</p>{payment.transaction_reference && <p>Reference: {payment.transaction_reference}</p>}{payment.admin_note && <p>{payment.admin_note}</p>}</div>
                )}
              </div>
            </article>
          );
        })}
      </section>

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

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(Number(amount) || 0);
}

function nextStatusOptions(status: string): string[] {
  if (status === 'requested') return ['processing', 'rejected'];
  if (status === 'processing') return ['paid', 'failed'];
  if (status === 'failed') return ['processing', 'rejected'];
  return [];
}

