'use client';

import { useEffect, useMemo, useState } from 'react';

type SnapshotRow = {
  id: number;
  snapshot_key: string | null;
  strategy_name: string | null;
  keyword: string | null;
  geo: string | null;
  timeframe: string | null;
  source: string | null;
  processed: boolean | null;
  processed_at: string | null;
  last_error: string | null;
  created_at: string | null;
};

type ListResponse = {
  items: SnapshotRow[];
  page: number;
  pageSize: number;
  total: number;
};

export default function TrendsSnapshotsClient() {
  const [items, setItems] = useState<SnapshotRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [strategy, setStrategy] = useState('');
  const [keyword, setKeyword] = useState('');
  const [processed, setProcessed] = useState<'all' | 'processed' | 'unprocessed'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [modalData, setModalData] = useState<unknown | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
      if (strategy.trim()) params.set('strategy', strategy.trim());
      if (keyword.trim()) params.set('keyword', keyword.trim());
      if (processed !== 'all') params.set('processed', processed);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/admin/data/trends-snapshots?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = (await res.json()) as ListResponse & { error?: string };
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
    void fetchList(1);
  }, []);

  const refresh = () => void fetchList(page);

  async function updateProcessed(id: number, processedValue: boolean) {
    try {
      const res = await fetch(`/api/admin/data/trends-snapshots/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processed: processedValue,
          reset_error: !processedValue,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...json } : row)));
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteRow(id: number) {
    if (!confirm('Delete this snapshot?')) return;
    try {
      const res = await fetch(`/api/admin/data/trends-snapshots/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      setItems((prev) => prev.filter((r) => r.id !== id));
      setToast(`Deleted snapshot ${id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function viewJson(id: number) {
    try {
      const res = await fetch(`/api/admin/data/trends-snapshots/${id}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Load failed');
      setModalData(json.raw_payload ?? json);
      setModalOpen(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function reprocess(id: number) {
    try {
      const res = await fetch(`/api/admin/trends-snapshots/${id}/reprocess`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to enqueue');
      setToast(`Reprocess job ${json.jobId} enqueued`);
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
            <label className="text-gray-700">Strategy name</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              placeholder="strategy name"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="text-gray-700">Keyword</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="keyword"
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="text-gray-700">Processed</label>
            <select
              value={processed}
              onChange={(e) => setProcessed(e.target.value as typeof processed)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="processed">Processed</option>
              <option value="unprocessed">Unprocessed</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-gray-700">
          <label className="flex items-center gap-2">
            <span>Start date</span>
            <input
              type="date"
              className="rounded-md border px-2 py-1 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2">
            <span>End date</span>
            <input
              type="date"
              className="rounded-md border px-2 py-1 text-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
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
              <th className="px-3 py-2">Strategy</th>
              <th className="px-3 py-2">Geo / Timeframe</th>
              <th className="px-3 py-2">Keyword</th>
              <th className="px-3 py-2">Snapshot Key</th>
              <th className="px-3 py-2">Processed</th>
              <th className="px-3 py-2">Error</th>
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
                  {row.strategy_name ?? '—'}
                  <div className="text-xs text-gray-500">{row.source ?? 'google_trends'}</div>
                </td>
                <td className="px-3 py-2">
                  {row.geo ?? 'GLOBAL'} / {row.timeframe ?? 'today 12-m'}
                </td>
                <td className="px-3 py-2">{row.keyword ?? '—'}</td>
                <td className="px-3 py-2 max-w-[220px] break-words text-xs text-gray-600">
                  {row.snapshot_key ?? '—'}
                </td>
                <td className="px-3 py-2 text-xs">
                  <div>{row.processed ? 'Yes' : 'No'}</div>
                  {row.processed_at && (
                    <div className="text-gray-500">{row.processed_at}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-red-600">
                  {row.last_error ?? '—'}
                </td>
                <td className="px-3 py-2 text-right space-y-1">
                  <button
                    type="button"
                    onClick={() => viewJson(row.id)}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100"
                  >
                    View JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => updateProcessed(row.id, true)}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100"
                  >
                    Mark processed
                  </button>
                  <button
                    type="button"
                    onClick={() => updateProcessed(row.id, false)}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100"
                  >
                    Mark unprocessed
                  </button>
                  <button
                    type="button"
                    onClick={() => reprocess(row.id)}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100"
                  >
                    Reprocess
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRow(row.id)}
                    className="rounded-md border px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && !error && (
              <tr>
                <td className="px-4 py-4 text-sm text-gray-500" colSpan={8}>
                  No snapshots found.
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Snapshot JSON</div>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setModalData(null);
                }}
                className="rounded-md border px-2 py-1 text-xs hover:bg-gray-100"
              >
                Close
              </button>
            </div>
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-gray-800">
              {JSON.stringify(modalData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
