'use client';

import { useEffect, useMemo, useState } from 'react';

type RawRedditPost = {
  id: number;
  source_post_id: string;
  subreddit: string | null;
  title: string | null;
  url: string | null;
  score: number | null;
  num_comments: number | null;
  selftext: string | null;
  created_utc: string | null;
  selected_for_idea: boolean;
  is_deleted: boolean;
  admin_note: string | null;
};

type ApiResponse = {
  items: RawRedditPost[];
  page: number;
  pageSize: number;
  total: number;
  error?: string;
};

export default function RedditPostsClient() {
  const [items, setItems] = useState<RawRedditPost[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subreddit, setSubreddit] = useState('');
  const [query, setQuery] = useState('');
  const [minScore, setMinScore] = useState<string>('');
  const [selected, setSelected] = useState<'all' | 'true' | 'false'>('all');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [noteEdits, setNoteEdits] = useState<Record<number, string>>({});

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  async function fetchData(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(nextPage));
      params.set('pageSize', String(pageSize));
      if (subreddit.trim()) params.set('subreddit', subreddit.trim());
      if (query.trim()) params.set('q', query.trim());
      if (minScore.trim()) params.set('minScore', minScore.trim());
      if (selected !== 'all') params.set('selected', selected);
      if (includeDeleted) params.set('includeDeleted', 'true');

      const res = await fetch(`/api/admin/data/reddit-posts?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch');
      }
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
    void fetchData(1);
  }, []);

  const refresh = () => void fetchData(page);

  const updateRow = async (id: number, updates: Partial<RawRedditPost>) => {
    try {
      const res = await fetch('/api/admin/data/reddit-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Update failed');
      }
      setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...json } : row)));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="text-sm font-semibold text-gray-900">Filters</div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1 text-sm">
            <label className="text-gray-700">Subreddit</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={subreddit}
              onChange={(e) => setSubreddit(e.target.value)}
              placeholder="e.g. Entrepreneur"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="text-gray-700">Keyword</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title/body"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="text-gray-700">Min score</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              placeholder="e.g. 10"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <span>Selected:</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value as typeof selected)}
              className="rounded-md border px-2 py-1 text-sm"
            >
              <option value="all">All</option>
              <option value="true">Only selected</option>
              <option value="false">Not selected</option>
            </select>
          </div>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
            />
            Include deleted
          </label>
          <button
            type="button"
            onClick={() => void fetchData(1)}
            className="rounded-md border px-3 py-1 text-sm text-gray-800 hover:bg-gray-100"
          >
            Apply
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={refresh}
          className="rounded-md border px-3 py-1 text-sm text-gray-800 hover:bg-gray-100"
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <div>
          Page {page} of {totalPages} ({total} rows)
        </div>
        {error && <div className="text-red-600">{error}</div>}
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Subreddit</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Comments</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Selected</th>
              <th className="px-3 py-2">Deleted</th>
              <th className="px-3 py-2">Admin note</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const noteValue = noteEdits[row.id] ?? row.admin_note ?? '';
              return (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {row.created_utc ?? '—'}
                  </td>
                  <td className="px-3 py-2">{row.subreddit ?? '—'}</td>
                  <td className="px-3 py-2">{row.score ?? 0}</td>
                  <td className="px-3 py-2">{row.num_comments ?? 0}</td>
                  <td className="px-3 py-2 max-w-xs">
                    <a
                      href={row.url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      {row.title ?? row.source_post_id}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateRow(row.id, { selected_for_idea: !row.selected_for_idea })
                      }
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      {row.selected_for_idea ? 'Selected' : 'Select'}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => updateRow(row.id, { is_deleted: !row.is_deleted })}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      {row.is_deleted ? 'Restore' : 'Delete'}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      className="w-full rounded-md border px-2 py-1 text-xs"
                      rows={2}
                      value={noteValue}
                      onChange={(e) =>
                        setNoteEdits((prev) => ({
                          ...prev,
                          [row.id]: e.target.value,
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => updateRow(row.id, { admin_note: noteValue })}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && !error && (
              <tr>
                <td className="px-4 py-4 text-sm text-gray-500" colSpan={9}>
                  No posts found.
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
            void fetchData(next);
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
            void fetchData(next);
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
