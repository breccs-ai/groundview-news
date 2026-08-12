'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type PayoutProfile = {
  payment_method: string;
  recipient_name: string;
  country: string;
  currency: string;
  service_name: string | null;
  payment_details: string;
};

type Share = {
  id: string;
  month_start: string | null;
  weighted_views: number;
  view_share: number;
  amount_earned: number;
  status: string;
};

type PaymentRequest = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  requested_at: string;
  transaction_reference: string | null;
  admin_note: string | null;
};

type RemunerationData = {
  payout_profile: PayoutProfile | null;
  shares: Share[];
  requests: PaymentRequest[];
  summary: {
    total_earned: number;
    available: number;
    pending_payment: number;
    paid: number;
    share_percent: number;
    minimum_request: number;
    accruing_estimate: number;
    current_pool: number;
  };
  article_performance: Array<{
    id: string;
    title: string;
    weighted_views: number;
    share_of_writer_engagement: number;
    estimated_earnings: number;
  }>;
};

const EMPTY_PROFILE: PayoutProfile = {
  payment_method: 'bank_transfer',
  recipient_name: '',
  country: '',
  currency: 'GBP',
  service_name: '',
  payment_details: '',
};

function money(value: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value) || 0);
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—';
}

export default function RemunerationPanel() {
  const [data, setData] = useState<RemunerationData | null>(null);
  const [profile, setProfile] = useState<PayoutProfile>(EMPTY_PROFILE);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const token = async () => (await supabase.auth.getSession()).data.session?.access_token || '';

  const load = useCallback(async () => {
    setLoading(true);
    const accessToken = await token();
    const res = await fetch('/api/journalist/remuneration', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      const next = body as RemunerationData;
      setData(next);
      setProfile(next.payout_profile || EMPTY_PROFILE);
      setRequestAmount(next.summary.available.toFixed(2));
    } else {
      setMessage({ kind: 'error', text: body.error || 'Could not load earnings.' });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const accessToken = await token();
    const res = await fetch('/api/journalist/remuneration', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage({ kind: 'error', text: body.error || 'Could not save payout details.' });
      return;
    }
    setMessage({ kind: 'success', text: 'Payout details saved securely.' });
    await load();
  };

  const requestPayment = async () => {
    setSaving(true);
    setMessage(null);
    const accessToken = await token();
    const res = await fetch('/api/journalist/payment-requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(requestAmount), note: requestNote }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage({ kind: 'error', text: body.error || 'Could not request payment.' });
      return;
    }
    setRequestNote('');
    setMessage({ kind: 'success', text: 'Payment request sent to the editorial accounts team.' });
    await load();
  };

  if (loading) {
    return <section className="border border-gray-200 p-6 text-sm text-gray-500">Loading earnings…</section>;
  }
  if (!data) return null;

  const canRequest =
    Boolean(data.payout_profile) &&
    data.summary.available >= data.summary.minimum_request &&
    Number(requestAmount) >= data.summary.minimum_request &&
    Number(requestAmount) <= data.summary.available;

  return (
    <section className="space-y-6" id="earnings-and-payments">
      <div className="border border-amber-200 bg-amber-50 p-6 rounded-sm">
        <div className="flex items-start gap-3">
          <Wallet className="text-amber-800 mt-0.5" size={20} />
          <div className="space-y-2 text-sm text-amber-950">
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Earnings and the writer share pool
            </h2>
            <p>
              Ground View News sets aside {data.summary.share_percent}% of net advertising revenue for writers.
              Your share is based on meaningful reader engagement with your published work, so earnings vary with
              advertising income and article performance and are never guaranteed.
            </p>
            <p>
              The strongest contribution is thoughtful, credible journalism. If you are proud of an article, you are
              welcome to share it with your own community. You may also introduce appropriate advertising partners,
              but neither activity is required and neither affects editorial decisions.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ['Accruing this month', money(data.summary.accruing_estimate)],
          ['Total earned', money(data.summary.total_earned)],
          ['Available to request', money(data.summary.available)],
          ['Payment in progress', money(data.summary.pending_payment)],
          ['Paid to date', money(data.summary.paid)],
        ].map(([label, value]) => (
          <div key={label} className="border border-gray-200 bg-white p-4 rounded-sm">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {message && (
        <p className={`p-3 text-sm border rounded-sm ${message.kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          {message.text}
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={saveProfile} className="border border-gray-200 p-5 rounded-sm space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">Payout instructions</h3>
            <p className="text-xs text-gray-500 mt-1">Used only by the accounts team for manual remittance. Never enter a password or PIN.</p>
          </div>
          <label className="block text-sm">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Payment method</span>
            <select className="w-full border border-gray-300 p-2.5" value={profile.payment_method} onChange={(e) => setProfile({ ...profile, payment_method: e.target.value })}>
              <option value="bank_transfer">Bank transfer</option>
              <option value="wise">Wise</option>
              <option value="paypal">PayPal</option>
              <option value="mobile_money">Mobile money</option>
              <option value="remittance_service">Remittance service</option>
              <option value="other">Other</option>
            </select>
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField label="Recipient/account-holder name" value={profile.recipient_name} onChange={(recipient_name) => setProfile({ ...profile, recipient_name })} />
            <TextField label="Country" value={profile.country} onChange={(country) => setProfile({ ...profile, country })} />
            <TextField label="Currency (3-letter code)" value={profile.currency} onChange={(currency) => setProfile({ ...profile, currency: currency.toUpperCase().slice(0, 3) })} />
            <TextField label="Service/provider name" value={profile.service_name || ''} onChange={(service_name) => setProfile({ ...profile, service_name })} />
          </div>
          <label className="block text-sm">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Payment destination and remittance instructions</span>
            <textarea required rows={5} maxLength={1200} className="w-full border border-gray-300 p-2.5 resize-y" value={profile.payment_details} onChange={(e) => setProfile({ ...profile, payment_details: e.target.value })} placeholder="For example: Wise email, PayPal email, mobile-money number and network, or bank account details required for your country." />
          </label>
          <button disabled={saving} className="px-4 py-2.5 bg-[#0f1f3d] text-white text-sm font-semibold disabled:opacity-50">Save payout instructions</button>
        </form>

        <div className="border border-gray-200 p-5 rounded-sm space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">Request a payment</h3>
            <p className="text-xs text-gray-500 mt-1">Minimum request: {money(data.summary.minimum_request)}. Requests are paid manually using your saved instructions.</p>
          </div>
          {!data.payout_profile && <p className="text-sm text-amber-800 bg-amber-50 p-3">Save payout instructions before requesting payment.</p>}
          <TextField label="Amount (GBP)" value={requestAmount} type="number" onChange={setRequestAmount} />
          <label className="block text-sm">
            <span className="block text-xs font-semibold text-gray-600 mb-1">Optional note to accounts</span>
            <textarea rows={3} maxLength={500} className="w-full border border-gray-300 p-2.5" value={requestNote} onChange={(e) => setRequestNote(e.target.value)} />
          </label>
          <button type="button" disabled={saving || !canRequest} onClick={() => void requestPayment()} className="px-4 py-2.5 bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50">Request payment</button>
          <button type="button" onClick={() => void load()} className="ml-2 inline-flex items-center gap-1 text-xs text-gray-500"><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      <Ledger title="How your articles are contributing this month">
        <p className="text-xs text-gray-500 mb-3">Estimates change as advertising revenue and readership develop through the month. Current estimated writer pool: {money(data.summary.current_pool)}.</p>
        {data.article_performance.length === 0 ? <Empty text="No engagement recorded for your articles this month." /> : data.article_performance.map((article) => (
          <div key={article.id} className="grid sm:grid-cols-[1fr_auto_auto] gap-2 py-2 border-b text-xs">
            <span className="font-medium text-gray-900">{article.title}</span>
            <span>{(article.share_of_writer_engagement * 100).toFixed(1)}% of your engagement</span>
            <strong className="text-right">{money(article.estimated_earnings)} estimated</strong>
          </div>
        ))}
      </Ledger>

      <div className="grid lg:grid-cols-2 gap-6">
        <Ledger title="Monthly earnings">
          {data.shares.length === 0 ? <Empty text="No settled earnings yet." /> : data.shares.map((row) => (
            <div key={row.id} className="grid grid-cols-4 gap-2 py-2 border-b text-xs">
              <span>{date(row.month_start)}</span><span>{Number(row.weighted_views || 0).toFixed(2)} weighted views</span><span>{(Number(row.view_share || 0) * 100).toFixed(2)}%</span><strong className="text-right">{money(row.amount_earned)}</strong>
            </div>
          ))}
        </Ledger>
        <Ledger title="Payment requests">
          {data.requests.length === 0 ? <Empty text="No payment requests yet." /> : data.requests.map((row) => (
            <div key={row.id} className="py-2 border-b text-xs flex justify-between gap-3">
              <div><strong>{money(row.amount, row.currency)}</strong><p className="text-gray-500">{new Date(row.requested_at).toLocaleDateString('en-GB')}</p></div>
              <div className="text-right"><span className="capitalize font-semibold">{row.status}</span>{row.transaction_reference && <p className="text-gray-500">Ref: {row.transaction_reference}</p>}{row.admin_note && <p className="text-gray-500">{row.admin_note}</p>}</div>
            </div>
          ))}
        </Ledger>
      </div>
    </section>
  );
}

function TextField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-sm"><span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span><input required type={type} step={type === 'number' ? '0.01' : undefined} className="w-full border border-gray-300 p-2.5" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function Ledger({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="border border-gray-200 p-5 rounded-sm"><h3 className="font-semibold text-gray-900 mb-3">{title}</h3>{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-gray-500 py-4">{text}</p>;
}
