'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AdminInput,
  AdminSelect,
  CardBody,
  CardHeading,
  DataTable,
  GlassCard,
} from '@/components/admin/primitives';

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
  is_deleted?: boolean | null;
  deleted_at?: string | null;
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
  const [includeDeleted, setIncludeDeleted] = useState(false);

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
      if (includeDeleted) params.set('includeDeleted', 'true');

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
          reset_error: processedValue,
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
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...json } : r)));
      setToast(`Deleted snapshot ${id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function restoreRow(id: number) {
    try {
      const res = await fetch(`/api/admin/data/trends-snapshots/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_deleted: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Restore failed');
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...json } : r)));
      setToast(`Restored snapshot ${id}`);
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
      <GlassCard>
        <CardHeading title="Filters" description="Inspect Google Trends snapshots." />
        <CardBody className="space-y-4 pt-0">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2 text-sm">
              <label className="text-muted-foreground">Strategy name</label>
              <AdminInput
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                placeholder="strategy name"
              />
            </div>
            <div className="space-y-2 text-sm">
              <label className="text-muted-foreground">Keyword</label>
              <AdminInput
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="keyword"
              />
            </div>
            <div className="space-y-2 text-sm">
              <label className="text-muted-foreground">Processed</label>
              <AdminSelect
                value={processed}
                onChange={(e) => setProcessed(e.target.value as typeof processed)}
              >
                <option value="all">All</option>
                <option value="processed">Processed</option>
                <option value="unprocessed">Unprocessed</option>
              </AdminSelect>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/80">
            <label className="flex items-center gap-2">
              <span>Start date</span>
              <AdminInput
                type="date"
                className="h-10 w-auto px-3 py-1"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2">
              <span>End date</span>
              <AdminInput
                type="date"
                className="h-10 w-auto px-3 py-1"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
              />
              Include deleted
            </label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void fetchList(1)}
            >
              Apply
            </Button>
          </div>
        </CardBody>
      </GlassCard>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void fetchList(page)}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
        <div className="text-muted-foreground">
          Page {page} of {totalPages} ({total} rows)
        </div>
        {error && <div className="text-destructive">{error}</div>}
        {toast && <div className="text-emerald-500">{toast}</div>}
      </div>

      <GlassCard>
        <CardBody className="overflow-x-auto p-0">
          <DataTable>
            <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Strategy</th>
                <th className="px-3 py-2">Geo / Timeframe</th>
                <th className="px-3 py-2">Keyword</th>
                <th className="px-3 py-2">Snapshot Key</th>
                <th className="px-3 py-2">Processed</th>
                <th className="px-3 py-2">Deleted</th>
                <th className="px-3 py-2">Error</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {items.map((row) => (
                <tr key={row.id} className="align-top transition hover:bg-secondary/8">
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {row.created_at ?? '—'}
                  </td>
                  <td className="px-3 py-3">
                    {row.strategy_name ?? '—'}
                    <div className="text-xs text-muted-foreground">{row.source ?? 'google_trends'}</div>
                  </td>
                  <td className="px-3 py-3">
                    {row.geo ?? 'GLOBAL'} / {row.timeframe ?? 'today 12-m'}
                  </td>
                  <td className="px-3 py-3">{row.keyword ?? '—'}</td>
                  <td className="max-w-[220px] break-words px-3 py-3 text-xs text-muted-foreground">
                    {row.snapshot_key ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <div>{row.processed ? 'Yes' : 'No'}</div>
                    {row.processed_at && (
                      <div className="text-muted-foreground">{row.processed_at}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {row.is_deleted ? (
                      <div>
                        Deleted
                        {row.deleted_at && (
                          <div className="text-muted-foreground">{row.deleted_at}</div>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-destructive">
                    {row.last_error ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-right space-y-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="rounded-full px-3"
                      onClick={() => viewJson(row.id)}
                    >
                      View JSON
                    </Button>
                    {row.processed ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full px-3"
                        onClick={() => updateProcessed(row.id, false)}
                      >
                        Mark unprocessed
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full px-3"
                        onClick={() => updateProcessed(row.id, true)}
                      >
                        Mark processed
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="rounded-full px-3"
                      onClick={() => reprocess(row.id)}
                    >
                      Reprocess
                    </Button>
                    {row.is_deleted ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full px-3"
                        onClick={() => restoreRow(row.id)}
                      >
                        Restore
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full px-3 text-destructive hover:bg-destructive/10"
                        onClick={() => deleteRow(row.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && !error && (
                <tr>
                  <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={8}>
                    No snapshots found.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </CardBody>
      </GlassCard>

      <div className="flex items-center gap-3 text-sm">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            const next = Math.max(1, page - 1);
            setPage(next);
            void fetchList(next);
          }}
          disabled={page === 1}
        >
          Prev
        </Button>
        <div className="text-muted-foreground">Page {page} of {totalPages}</div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            const next = Math.min(totalPages, page + 1);
            setPage(next);
            void fetchList(next);
          }}
          disabled={page >= totalPages}
        >
          Next
        </Button>
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
