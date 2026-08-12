'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Membership = {
  status: 'invited' | 'accepted' | 'declined' | 'expired' | 'waitlisted' | 'revoked';
  qualifying_article_count: number;
  invitation_expires_at: string | null;
};

const CONFIDENCE_OPTIONS = [
  'Writer application review',
  'Article review and feedback',
  'Fact-checking',
  'Mentoring contributors',
  'Audience development',
  'Advertising introductions',
];

export default function FoundingLeadEditorPanel() {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [confidence, setConfidence] = useState<string[]>([]);
  const [support, setSupport] = useState('');
  const [ideas, setIdeas] = useState('');
  const [followUp, setFollowUp] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) return;
    const res = await fetch('/api/journalist/lead-editor-program', {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setMembership(body.membership || null);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const respond = async (response: 'accept' | 'decline') => {
    if (!window.confirm(response === 'accept' ? 'Accept the Founding Lead Editor responsibilities?' : 'Decline this invitation?')) return;
    setWorking(true);
    setMessage(null);
    const { data } = await supabase.auth.getSession();
    const res = await fetch('/api/journalist/lead-editor-program', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
      body: JSON.stringify({
        response,
        confidence_areas: confidence,
        support_requested: support,
        ideas,
        permission_to_follow_up: followUp,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? (response === 'accept' ? 'Welcome. Your Lead Editor access is now active.' : 'Your response has been recorded. Your writer access is unchanged.') : body.error || 'Could not save your response.');
    if (res.ok) await load();
    setWorking(false);
  };

  if (!membership) return null;
  if (membership.status === 'accepted') {
    return <section id="founding-lead-editor" className="border border-amber-300 bg-amber-50 p-6"><p className="text-xs font-semibold uppercase tracking-widest text-amber-800">Founding Lead Editor</p><h2 className="text-xl font-bold mt-1">Your Lead Editor access is active</h2><p className="text-sm text-gray-700 mt-2">Assigned applications appear in your private review queue below. Keep applicant information confidential and make independent, timely decisions.</p>{message && <p className="text-sm mt-3">{message}</p>}</section>;
  }
  if (membership.status === 'waitlisted') {
    return <section id="founding-lead-editor" className="border border-gray-200 p-6"><h2 className="text-xl font-bold">Founding Lead Editor waiting list</h2><p className="text-sm text-gray-600 mt-2">You qualified after five published articles. The first ten places are currently reserved or accepted; we will contact you automatically if a place becomes available.</p></section>;
  }
  if (membership.status !== 'invited') return null;

  return (
    <section id="founding-lead-editor" className="border-2 border-amber-400 bg-amber-50 p-6 space-y-5">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-amber-800">Invitation</p><h2 className="text-2xl font-bold">Become a Founding Lead Editor</h2><p className="text-sm text-gray-700 mt-2">Your fifth published article earned this optional invitation. Lead Editors review assigned writer applications within 24 hours, protect applicant information and apply Ground View News editorial standards independently.</p></div>
      <div className="text-sm text-gray-700 space-y-2"><p>This is not employment or guaranteed income. The planned 1.02 performance weighting applies only inside the existing writer pool when the separate financial stage is activated; Ground View News retains 70% of net advertising revenue.</p><p><strong>Respond by:</strong> {membership.invitation_expires_at ? new Date(membership.invitation_expires_at).toLocaleString('en-GB') : 'within 14 days'}</p></div>
      <fieldset><legend className="font-semibold text-sm">What do you feel confident helping with? (optional)</legend><div className="grid sm:grid-cols-2 gap-2 mt-2">{CONFIDENCE_OPTIONS.map((option) => <label key={option} className="text-sm flex gap-2"><input type="checkbox" checked={confidence.includes(option)} onChange={(event) => setConfidence((current) => event.target.checked ? [...current, option] : current.filter((item) => item !== option))} />{option}</label>)}</div></fieldset>
      <label className="block text-sm font-semibold">What support would help you thrive? (optional)<textarea value={support} maxLength={2000} onChange={(event) => setSupport(event.target.value)} className="mt-1 w-full border border-gray-300 p-3 min-h-[90px] font-normal" /></label>
      <label className="block text-sm font-semibold">Ideas for improving the platform, readership or suitable advertiser relationships (optional)<textarea value={ideas} maxLength={3000} onChange={(event) => setIdeas(event.target.value)} className="mt-1 w-full border border-gray-300 p-3 min-h-[90px] font-normal" /></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={followUp} onChange={(event) => setFollowUp(event.target.checked)} />Ground View News may contact me to discuss this feedback.</label>
      {message && <p className="text-sm border border-gray-200 bg-white p-3">{message}</p>}
      <div className="flex flex-wrap gap-3"><button type="button" disabled={working} onClick={() => void respond('accept')} className="bg-green-700 text-white px-5 py-2 font-semibold disabled:opacity-50">Accept invitation</button><button type="button" disabled={working} onClick={() => void respond('decline')} className="border border-gray-400 bg-white px-5 py-2 font-semibold disabled:opacity-50">Decline</button></div>
    </section>
  );
}
