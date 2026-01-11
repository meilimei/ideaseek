'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AdminInput,
  AdminSelect,
  CardBody,
  CardHeading,
  DataTable,
  GlassCard,
} from '@/components/admin/primitives';
import BulkIdeasActionsDialog from '@/components/admin/BulkIdeasActionsDialog';

type IdeaRow = {
  id: string;
  title: string;
  one_liner: string | null;
  source_url: string | null;
  published: boolean;
  source_type: string | null;
  tags?: string[] | null;
  score_overall?: number | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  pinned: boolean | null;
  featured: boolean | null;
  created_by?: string | null;
  published_at?: string | null;
  unpublished_at?: string | null;
  status?: string | null;
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
  const [enrichingId, setEnrichingId] = useState<string | null>(null);

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

  async function reEnrich(id: string) {
    setEnrichingId(id);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/ideas/${id}/enrich`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to enqueue');
      setToast(`Enqueued enrich job ${json.jobId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setEnrichingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <GlassCard>
        <CardHeading title="Filters" description="Slice the ideas dataset quickly." />
        <CardBody className="space-y-4 pt-0">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 text-sm">
              <label className="text-muted-foreground">Keyword</label>
              <AdminInput
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="title or one-liner"
              />
            </div>
            <div className="space-y-2 text-sm">
              <label className="text-muted-foreground">Source type</label>
              <AdminInput
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                placeholder="reddit / youtube / trends"
              />
            </div>
            <div className="space-y-2 text-sm">
              <label className="text-muted-foreground">Status</label>
              <AdminSelect
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
                <option value="deleted">Deleted</option>
              </AdminSelect>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/80">
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
              <AdminInput
                className="h-9 w-40 px-3 py-1"
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                placeholder="user id"
              />
            </div>
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
        <BulkIdeasActionsDialog />
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
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2">Pinned</th>
                <th className="px-3 py-2">Featured</th>
                <th className="px-3 py-2">Updated</th>
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
                    <div className="text-foreground">{row.source_type ?? '—'}</div>
                    {row.deleted_at && (
                      <div className="text-xs text-destructive">
                        Deleted {row.deleted_at}
                      </div>
                    )}
                  </td>
                  <td className="max-w-xs break-words px-3 py-3">
                    <div className="font-semibold text-foreground">{row.title}</div>
                    {row.one_liner && (
                      <div className="text-xs text-muted-foreground">{row.one_liner}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 capitalize">
                    {row.deleted_at
                      ? 'Deleted'
                      : row.published
                        ? 'Published'
                        : 'Draft'}
                    {row.published_at && row.published && (
                      <div className="text-xs text-muted-foreground">
                        Published at {row.published_at}
                      </div>
                    )}
                    {row.unpublished_at && !row.published && (
                      <div className="text-xs text-muted-foreground">
                        Unpublished at {row.unpublished_at}
                      </div>
                    )}
                    {row.status && (
                      <div className="mt-1">
                        <Badge variant="secondary" className="capitalize">
                          {row.status}
                        </Badge>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {row.score_overall != null
                      ? Number(row.score_overall).toFixed(2)
                      : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(row.tags ?? []).slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="secondary" className="capitalize">
                          {tag}
                        </Badge>
                      ))}
                      {(row.tags ?? []).length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs">{row.pinned ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-3 text-xs">{row.featured ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {row.updated_at ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-right space-y-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="rounded-full px-3"
                      disabled={enrichingId === row.id}
                      onClick={() => reEnrich(row.id)}
                    >
                      {enrichingId === row.id ? 'Enriching…' : 'Re-enrich'}
                    </Button>
                    {row.deleted_at ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleFlag(row.id, 'soft_delete', false)}
                        className="rounded-full px-3"
                      >
                        Restore
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full px-3 text-destructive hover:bg-destructive/10"
                        onClick={() => toggleFlag(row.id, 'soft_delete', true)}
                      >
                        Delete
                      </Button>
                    )}
                    {row.published ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full px-3"
                        onClick={() => toggleFlag(row.id, 'publish', false)}
                      >
                        Unpublish
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full px-3"
                        onClick={() => toggleFlag(row.id, 'publish', true)}
                      >
                        Publish
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="rounded-full px-3"
                      onClick={() => toggleFlag(row.id, 'pin', !(row.pinned ?? false))}
                    >
                      {row.pinned ? 'Unpin' : 'Pin'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="rounded-full px-3"
                      onClick={() => toggleFlag(row.id, 'feature', !(row.featured ?? false))}
                    >
                      {row.featured ? 'Unfeature' : 'Feature'}
                    </Button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !error && (
                <tr>
                  <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={10}>
                    No ideas found.
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
        <div className="text-muted-foreground">
          Page {page} of {totalPages}
        </div>
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
    </div>
  );
}
