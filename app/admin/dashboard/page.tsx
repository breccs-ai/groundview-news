'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';
import { getCategoryMeta } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { FilePlus, Pencil, Trash2, Globe, TriangleAlert as AlertTriangle, RefreshCw, CircleCheck as CheckCircle2, Circle as XCircle } from 'lucide-react';

type DbStatus = { ok: boolean; publishedCount: number; draftCount: number; error?: string } | null;

type Article = {
  id: string;
  title: string;
  slug: string;
  category: string;
  label: string;
  status: string;
  published_at: string | null;
  created_at: string;
  author_name: string;
};

type ToastMsg = { type: 'success' | 'error'; text: string };

type PendingJournalist = {
  id: string;
  full_name: string;
  pen_name: string | null;
  email: string;
  bio: string | null;
  expertise: string[] | null;
  created_at: string;
};

export default function AdminDashboard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingJournalists, setPendingJournalists] = useState<PendingJournalist[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<DbStatus>(null);
  const [rejecting, setRejecting] = useState<PendingJournalist | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const showToast = (type: ToastMsg['type'], text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchPendingJournalists = useCallback(async () => {
    setPendingLoading(true);
    const res = await fetch('/api/admin/journalists/pending', { method: 'GET' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast('error', body.error || 'Failed to load journalist applications.');
      setPendingJournalists([]);
      setPendingLoading(false);
      return;
    }
    setPendingJournalists((body.rows || []) as PendingJournalist[]);
    setPendingLoading(false);
  }, []);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, slug, category, label, status, published_at, created_at, author_name')
      .order('created_at', { ascending: false });

    if (error) {
      showToast('error', `Failed to load articles: ${error.message}`);
      setDbStatus({ ok: false, publishedCount: 0, draftCount: 0, error: error.message });
    } else {
      const rows = data as Article[];
      setArticles(rows);
      setDbStatus({
        ok: true,
        publishedCount: rows.filter((a) => a.status === 'published').length,
        draftCount: rows.filter((a) => a.status !== 'published').length,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchArticles();
    fetchPendingJournalists();
  }, [fetchArticles, fetchPendingJournalists]);

  const decideJournalist = async (journalist: PendingJournalist, action: 'approve' | 'reject', reason?: string) => {
    const res = await fetch('/api/admin/journalists/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        journalist_id: journalist.id,
        action,
        reason,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast('error', body.error || 'Action failed.');
      return;
    }
    showToast('success', action === 'approve' ? 'Journalist approved.' : 'Journalist rejected.');
    fetchPendingJournalists();
  };

  const handlePublish = async (article: Article) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('articles')
      .update({ status: 'published', published_at: article.published_at || now })
      .eq('id', article.id);

    if (error) {
      showToast('error', `Failed to publish: ${error.message}`);
      return;
    }

    await fetch('/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: article.slug }),
    }).catch(() => {});

    showToast('success', `"${article.title}" published.`);
    fetchArticles();
  };

  const handleUnpublish = async (article: Article) => {
    const { error } = await supabase
      .from('articles')
      .update({ status: 'draft' })
      .eq('id', article.id);

    if (error) {
      showToast('error', 'Failed to unpublish.');
      return;
    }

    await fetch('/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: article.slug }),
    }).catch(() => {});

    showToast('success', `"${article.title}" moved to draft.`);
    fetchArticles();
  };

  const confirmDelete = (id: string) => setDeleteId(id);

  const handleDelete = async () => {
    if (!deleteId) return;
    const article = articles.find((a) => a.id === deleteId);
    setDeleteId(null);

    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', deleteId);

    if (error) {
      showToast('error', 'Failed to delete article.');
      return;
    }

    if (article) {
      await fetch('/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: article.slug }),
      }).catch(() => {});
    }

    showToast('success', 'Article deleted.');
    fetchArticles();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      published: 'bg-green-100 text-green-800',
      draft: 'bg-gray-100 text-gray-600',
      pending: 'bg-amber-100 text-amber-800',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-sm capitalize ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  return (
    <AdminShell>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-sm shadow-lg text-sm font-medium max-w-sm ${
            toast.type === 'success'
              ? 'bg-green-800 text-green-100'
              : 'bg-red-800 text-red-100'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-sm shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Delete article?</p>
                <p className="text-xs text-gray-500 mt-1">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-sm text-gray-700 hover:border-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject journalist modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-sm shadow-xl p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Reject journalist application</p>
                <p className="text-xs text-gray-500 mt-1">
                  {rejecting.full_name} ({rejecting.email})
                </p>
              </div>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Reason *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 transition-colors resize-none"
              placeholder="Explain briefly why this application is not approved."
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => { setRejecting(null); setRejectReason(''); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-sm text-gray-700 hover:border-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const reason = rejectReason.trim();
                  if (reason.length < 3) {
                    showToast('error', 'Please provide a rejection reason.');
                    return;
                  }
                  const journalist = rejecting;
                  setRejecting(null);
                  setRejectReason('');
                  await decideJournalist(journalist, 'reject', reason);
                }}
                className="px-4 py-2 text-sm bg-amber-700 text-white rounded-sm hover:bg-amber-800 transition-colors font-semibold"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DB status banner */}
      {dbStatus && !dbStatus.ok && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-sm">
          <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Database error</p>
            <p className="text-xs text-red-700 mt-0.5">{dbStatus.error}</p>
            <p className="text-xs text-red-600 mt-1">Check that your Supabase URL and anon key are set correctly in Vercel environment variables.</p>
          </div>
        </div>
      )}
      {dbStatus && dbStatus.ok && (
        <div className="mb-6 flex items-center gap-6 p-3 bg-green-50 border border-green-200 rounded-sm text-xs text-green-800">
          <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-green-600" /> Database connected</span>
          <span><strong>{dbStatus.publishedCount}</strong> published</span>
          <span><strong>{dbStatus.draftCount}</strong> drafts</span>
        </div>
      )}

      {/* Pending journalist applications */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Pending Journalist Applications
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{pendingJournalists.length} pending</p>
          </div>
          <button
            onClick={fetchPendingJournalists}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-sm text-sm text-gray-700 hover:border-gray-400 transition-colors"
          >
            <RefreshCw size={14} className={pendingLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
          {pendingLoading ? (
            <div className="py-10 text-center text-sm text-gray-400">Loading applications…</div>
          ) : pendingJournalists.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">No pending applications.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Applicant</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500 hidden lg:table-cell">Bio</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500 hidden md:table-cell">Expertise</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Applied</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingJournalists.map((j) => (
                    <tr key={j.id} className="hover:bg-gray-50 transition-colors align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{j.full_name}</p>
                        {j.pen_name && <p className="text-xs text-gray-500 mt-0.5">{j.pen_name}</p>}
                        <p className="text-xs text-gray-400 mt-1">{j.email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 hidden lg:table-cell max-w-md">
                        <p className="line-clamp-3">{j.bio || '—'}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1.5 max-w-sm">
                          {(j.expertise || []).length === 0 ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : (
                            (j.expertise || []).map((x) => (
                              <span key={x} className="inline-flex px-2 py-0.5 text-xs rounded-sm bg-amber-50 text-amber-800 border border-amber-100">
                                {x}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(j.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => decideJournalist(j, 'approve')}
                            className="px-2.5 py-1 text-xs font-semibold bg-green-700 text-white rounded-sm hover:bg-green-600 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => { setRejecting(j); setRejectReason(''); }}
                            className="px-2.5 py-1 text-xs font-semibold bg-amber-700 text-white rounded-sm hover:bg-amber-800 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            Articles
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{articles.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchArticles}
            className="p-2 text-gray-400 hover:text-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link
            href="/admin/articles/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-700 hover:bg-green-600 text-white font-semibold text-sm rounded-sm transition-colors"
          >
            <FilePlus size={15} />
            Write New Article
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading articles…</div>
        ) : articles.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-500 mb-4">No articles yet.</p>
            <Link
              href="/admin/articles/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-sm hover:bg-blue-900 transition-colors"
            >
              <FilePlus size={14} />
              Write your first article
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Title
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500 hidden md:table-cell">
                    Category
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500 hidden lg:table-cell">
                    Published
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {articles.map((article) => {
                  const cat = getCategoryMeta(article.category);
                  return (
                    <tr key={article.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 line-clamp-1 max-w-xs">
                            {article.title}
                          </p>
                          {article.author_name && (
                            <p className="text-xs text-gray-400 mt-0.5">{article.author_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-sm ${cat.bg} ${cat.text}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">{statusBadge(article.status)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                        {article.published_at
                          ? formatDate(article.published_at)
                          : <span className="text-gray-300">Not published</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {article.status === 'published' ? (
                            <button
                              onClick={() => handleUnpublish(article)}
                              title="Unpublish (move to draft)"
                              className="p-1.5 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            >
                              <Globe size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePublish(article)}
                              title="Publish"
                              className="px-2.5 py-1 text-xs font-semibold bg-green-700 text-white rounded-sm hover:bg-green-600 transition-colors"
                            >
                              Publish
                            </button>
                          )}
                          <Link
                            href={`/admin/articles/edit/${article.id}`}
                            className="p-1.5 rounded text-gray-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </Link>
                          <button
                            onClick={() => confirmDelete(article.id)}
                            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
