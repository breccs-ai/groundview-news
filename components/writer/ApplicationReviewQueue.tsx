'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Review = {
  id: string;
  attempt_number: number;
  due_at: string;
  applicant: {
    full_name: string;
    pen_name: string | null;
    bio: string | null;
    expertise: string[] | null;
    country: string | null;
    how_heard_about: string | null;
  };
};

export default function ApplicationReviewQueue() {
  const [rows, setRows] = useState<Review[]>([]);
  const [isLead, setIsLead] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return setLoading(false);
    const res = await fetch('/api/journalist/application-reviews', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return setLoading(false);
    const body = await res.json().catch(() => ({}));
    setIsLead(res.ok);
    setRows(res.ok ? body.rows || [] : []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    if (!window.confirm(`${decision === 'approve' ? 'Approve' : 'Reject'} this application?`)) return;
    setWorking(id);
    setMessage(null);
    const { data } = await supabase.auth.getSession();
    const res = await fetch('/api/journalist/application-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
      body: JSON.stringify({ assignment_id: id, decision }),
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Application ${decision === 'approve' ? 'approved' : 'rejected'}.` : body.error || 'Decision failed.');
    if (res.ok) await load();
    setWorking(null);
  };

  if (loading || !isLead) return null;
  return (
    <section id="application-reviews" className="border border-gray-200 p-6 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Lead Editor</p>
        <h2 className="text-xl font-bold text-gray-900">Assigned writer applications</h2>
        <p className="text-sm text-gray-600 mt-1">Only applications assigned to you appear here. Review independently within 24 hours and keep applicant information private.</p>
      </div>
      {message && <p className="text-sm bg-gray-50 border border-gray-200 p-3">{message}</p>}
      {rows.length === 0 ? <p className="text-sm text-gray-500">No applications are currently assigned to you.</p> : rows.map((row) => (
        <article key={row.id} className="border border-gray-200 p-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-2">
            <div><strong>{row.applicant.full_name}</strong><p className="text-sm text-gray-600">Pen name: {row.applicant.pen_name || 'Not provided'}</p></div>
            <p className="text-xs text-gray-500">Due {new Date(row.due_at).toLocaleString('en-GB')}</p>
          </div>
          <p className="text-sm whitespace-pre-wrap">{row.applicant.bio}</p>
          <p className="text-sm"><strong>Areas:</strong> {(row.applicant.expertise || []).join(', ') || 'Not provided'}</p>
          <p className="text-sm"><strong>Country:</strong> {row.applicant.country || 'Not provided'}</p>
          <div className="flex gap-3">
            <button type="button" disabled={working === row.id} onClick={() => void decide(row.id, 'approve')} className="bg-green-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Approve</button>
            <button type="button" disabled={working === row.id} onClick={() => void decide(row.id, 'reject')} className="bg-red-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">Reject</button>
          </div>
        </article>
      ))}
    </section>
  );
}
