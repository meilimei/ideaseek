'use client';

import { useEffect, useMemo, useState } from 'react';

type IdeaRow = {
  id: string;
  title: string;
  one_liner: string | null;
  source_url: string | null;
  published: boolean;
  source_type: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  pinned: boolean | null;
  featured: boolean | null;
  created_by?: string | null;
};

type ListResponse = {
  items: IdeaRow[];
  page: number;
  pageSize: number;
  total: number;
};

export default function IdeasClient() {
  const [items, setItems] = useState<IdeaRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [keyword, setKeyword] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [status, setStatus] = useState<'all' | 'published' | 'unpublished' | 'deleted'>('all');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [createdBy, setCreatedBy] = useState('');

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  async function fetchList(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(nextPage));
      params.set('pageSize', String(pageSize));
      if (keyword.trim()) params.set('search', keyword.trim());
      if (sourceType.trim()) params.set('sourceType', sourceType.trim());
      if (status !== 'all') params.set('status', status);
      if (includeDeleted) params.set('includeDeleted', 'true');
      if (createdBy.trim()) params.set('createdBy', createdBy.trim());

      const res = await fetch(`/api/admin/ideas?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = (await res.json()) as ListResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to load ideas');
      setItems(json.items ?? []);
      setPage(json.page);
      setTotal(json.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchList(1);
  }, []);

  const refresh = () => void fetchList(page);

  async function toggleFlag(id: string, action: string, value: boolean) {
    try {
      const res = await fetch(`/api/admin/ideas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update');
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...json } : r)));
      setToast('Updated');
      void fetchList(page);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="text-sm font-semibold text-gray-900">Filters</div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1 text-sm">
            <label className="text-gray-700">Keyword</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="title or one-liner"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="text-gray-700">Source type</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              placeholder="reddit / youtube / trends"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="text-gray-700">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full rounded-md border px-3 py-2 text-sm"
           >
             <option value="all">All</option>
             <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-gray-700">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
            />
            Include deleted
          </label>
          <div className="flex items-center gap-2">
            <span>Created by</span>
            <input
              className="rounded-md border px-3 py-1 text-sm"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              placeholder="user id"
            />
          </div>
          <button
            type="button"
            onClick={() => void fetchList(1)}
            className="rounded-md border px-3 py-1 text-sm text-gray-800 hover:bg-gray-100"
          >
            Apply
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => void fetchList(page)}
          className="rounded-md border px-3 py-1 text-sm text-gray-800 hover:bg-gray-100"
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <div>
          Page {page} of {totalPages} ({total} rows)
        </div>
        {error && <div className="text-red-600">{error}</div>}
        {toast && <div className="text-green-700">{toast}</div>}
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Pinned</th>
              <th className="px-3 py-2">Featured</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="px-3 py-2 text-xs text-gray-600">
                  {row.created_at ?? '—'}
                </td>
                <td className="px-3 py-2">
                  {row.source_type ?? '—'}
                  {row.deleted_at && (
                    <div className="text-xs text-red-600">
                      Deleted {row.deleted_at}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 max-w-xs break-words">
                  <div className="font-medium text-gray-900">{row.title}</div>
                  {row.one_liner && (
                    <div className="text-xs text-gray-600">{row.one_liner}</div>
                  )}
                </td>
                <td className="px-3 py-2 capitalize">
                  {row.deleted_at
                    ? 'Deleted'
                    : row.published
                      ? 'Published'
                      : 'Draft'}
                </td>
                <td className="px-3 py-2 text-xs">{row.pinned ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2 text-xs">{row.featured ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {row.updated_at ?? '—'}
                </td>
                <td className="px-3 py-2 text-right space-y-1">
                  {row.deleted_at ? (
                    <button
                      type="button"
                      onClick={() => toggleFlag(row.id, 'soft_delete', false)}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleFlag(row.id, 'soft_delete', true)}
                      className="rounded-md border px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                  {row.published ? (
                    <button
                      type="button"
                      onClick={() => toggleFlag(row.id, 'publish', false)}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      Unpublish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleFlag(row.id, 'publish', true)}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      Publish
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleFlag(row.id, 'pin', !(row.pinned ?? false))}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100"
                  >
                    {row.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFlag(row.id, 'feature', !(row.featured ?? false))}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100"
                  >
                    {row.featured ? 'Unfeature' : 'Feature'}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && !error && (
              <tr>
                <td className="px-4 py-4 text-sm text-gray-500" colSpan={8}>
                  No ideas found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => {
            const next = Math.max(1, page - 1);
            setPage(next);
            void fetchList(next);
          }}
          disabled={page === 1}
          className="rounded-md border px-3 py-1 text-sm text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Prev
        </button>
        <div>
          Page {page} of {totalPages}
        </div>
        <button
          type="button"
          onClick={() => {
            const next = Math.min(totalPages, page + 1);
            setPage(next);
            void fetchList(next);
          }}
          disabled={page >= totalPages}
        className="rounded-md border px-3 py-1 text-sm text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>

    </div>
  );
}
