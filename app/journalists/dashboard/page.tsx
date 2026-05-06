'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { Plus } from 'lucide-react';

type Article = {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
  published_at: string | null;
};

type Profile = {
  full_name: string;
  pen_name: string | null;
  subscription_tier: string | null;
  articles_used_this_month: number;
};

const TIER_LIMITS: Record<string, number | null> = {
  starter: 4, standard: 12, professional: null,
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending Review', color: 'bg-amber-100 text-amber-800' },
  published: { label: 'Published',      color: 'bg-green-100 text-green-800' },
  draft:     { label: 'Draft',          color: 'bg-gray-100 text-gray-700' },
  rejected:  { label: 'Not accepted',   color: 'bg-red-100 text-red-700' },
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function JournalistDashboardPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/journalists/login'); return; }

      const [{ data: prof }, { data: arts }] = await Promise.all([
        supabase.from('profiles').select('full_name, pen_name, subscription_tier, articles_used_this_month').eq('id', session.user.id).maybeSingle(),
        supabase.from('articles').select('id, title, category, status, created_at, published_at').eq('author_name', session.user.id).order('created_at', { ascending: false }),
      ]);

      setProfile(prof as Profile || null);
      setArticles((arts as Article[]) || []);
      setLoading(false);
    })();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/journalists/login');
  };

  const tierLimit = TIER_LIMITS[profile?.subscription_tier || ''];
  const articlesRemaining = tierLimit === null ? 'Unlimited' : Math.max(0, tierLimit - (profile?.articles_used_this_month || 0));

  return (
    <>
      <Navbar />
      <main className="bg-white min-h-screen">
        <div style={{ backgroundColor: '#0f1f3d' }} className="py-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">Journalist Portal</p>
              <h1 className="text-2xl md:text-3xl font-bold text-white" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                My Articles
              </h1>
              {profile && <p className="text-gray-400 text-sm mt-1">Welcome, {profile.pen_name || profile.full_name}</p>}
            </div>
            <div className="flex items-center gap-3">
              <Link href="/journalists/submit"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-sm transition-colors"
                style={{ backgroundColor: '#B8860B', color: '#fff' }}>
                <Plus size={15} />
                Submit Article
              </Link>
              <button onClick={handleSignOut}
                className="inline-flex items-center px-4 py-2.5 text-sm font-semibold border border-white/30 text-gray-300 hover:text-white rounded-sm transition-colors">
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          {profile && (
            <div className="mb-8 p-5 bg-gray-50 border border-gray-200 rounded-sm flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Subscription</p>
                <p className="font-semibold text-gray-900 capitalize">{profile.subscription_tier || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Articles this month</p>
                <p className="font-semibold text-gray-900">{articlesRemaining} remaining</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-gray-200 rounded-sm">
              <p className="text-gray-400 text-base mb-4">You have not submitted any articles yet.</p>
              <Link href="/journalists/submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-sm"
                style={{ backgroundColor: '#B8860B', color: '#fff' }}>
                <Plus size={14} />
                Submit your first article
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {articles.map((article) => {
                const st = STATUS_LABELS[article.status] || { label: article.status, color: 'bg-gray-100 text-gray-600' };
                return (
                  <div key={article.id} className="py-5">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-sm ${st.color}`}>{st.label}</span>
                      <span className="text-xs text-gray-400 capitalize">{article.category}</span>
                    </div>
                    <p className="text-base font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                      {article.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {article.published_at ? `Published ${fmtDate(article.published_at)}` : `Submitted ${fmtDate(article.created_at)}`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
