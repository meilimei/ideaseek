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
  selected_for_idea?: boolean;
  selected?: boolean | null;
  is_deleted: boolean;
  admin_note: string | null;
  promoted_idea_id?: string | null;
  used_for_ideas?: boolean | null;
  promoted_at?: string | null;
};

const textareaClass =
  'w-full rounded-2xl border border-border/50 bg-card/60 px-3 py-2 text-sm text-foreground shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40';

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
  const [toast, setToast] = useState<{ message: string; ideaId?: string } | null>(null);

  const [subreddit, setSubreddit] = useState('');
  const [query, setQuery] = useState('');
  const [minScore, setMinScore] = useState<string>('');
  const [selected, setSelected] = useState<'all' | 'true' | 'false'>('all');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [noteEdits, setNoteEdits] = useState<Record<number, string>>({});
  const [promotingId, setPromotingId] = useState<number | null>(null);

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

  const promote = async (id: number) => {
    setPromotingId(id);
    setToast(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reddit-posts/${id}/promote`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to promote');
      }
      setToast({
        message: json.created
          ? `Created draft idea ${json.ideaId}`
          : `Already promoted, idea ${json.ideaId}`,
        ideaId: json.ideaId,
      });
      void fetchData(page);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
    setPromotingId(null);
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <CardHeading title="Filters" description="Find raw Reddit posts quickly." />
        <CardBody className="space-y-4 pt-0">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2 text-sm">
              <label className="text-muted-foreground">Subreddit</label>
              <AdminInput
                value={subreddit}
                onChange={(e) => setSubreddit(e.target.value)}
                placeholder="e.g. Entrepreneur"
              />
            </div>
            <div className="space-y-2 text-sm">
              <label className="text-muted-foreground">Keyword</label>
              <AdminInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title/body"
              />
            </div>
            <div className="space-y-2 text-sm">
              <label className="text-muted-foreground">Min score</label>
              <AdminInput
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/80">
            <div className="flex items-center gap-2">
              <span>Selected:</span>
              <AdminSelect
                value={selected}
                onChange={(e) => setSelected(e.target.value as typeof selected)}
                className="h-9 w-40 px-3 py-1"
              >
                <option value="all">All</option>
                <option value="true">Only selected</option>
                <option value="false">Not selected</option>
              </AdminSelect>
            </div>
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
              onClick={() => void fetchData(1)}
            >
              Apply
            </Button>
          </div>
        </CardBody>
      </GlassCard>

      {toast && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <span>{toast.message}</span>
          {toast.ideaId && (
            <>
              <span className="mx-2 text-gray-500">•</span>
              <a
                href={`/admin/data/ideas?search=${toast.ideaId}`}
                className="text-indigo-700 underline"
              >
                View in ideas admin
              </a>
              <span className="mx-2 text-gray-500">•</span>
              <a
                href={`/ideas/${toast.ideaId}`}
                className="text-indigo-700 underline"
                target="_blank"
                rel="noreferrer"
              >
                Open idea
              </a>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
        <div className="text-muted-foreground">
          Page {page} of {totalPages} ({total} rows)
        </div>
        {error && <div className="text-destructive">{error}</div>}
      </div>

      <GlassCard>
        <CardBody className="overflow-x-auto p-0">
          <DataTable>
            <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
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
            <tbody className="divide-y divide-border/30">
              {items.map((row) => {
                const isSelected = row.selected ?? row.selected_for_idea ?? false;
                const noteValue = noteEdits[row.id] ?? row.admin_note ?? '';
                return (
                  <tr key={row.id} className="align-top transition hover:bg-secondary/8">
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {row.created_utc ?? '—'}
                    </td>
                    <td className="px-3 py-3">{row.subreddit ?? '—'}</td>
                    <td className="px-3 py-3">{row.score ?? 0}</td>
                    <td className="px-3 py-3">{row.num_comments ?? 0}</td>
                    <td className="max-w-xs px-3 py-3">
                      <a
                        href={row.url ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {row.title ?? row.source_post_id}
                      </a>
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full px-3"
                        onClick={() => updateRow(row.id, { selected: !isSelected })}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </Button>
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full px-3"
                        onClick={() => updateRow(row.id, { is_deleted: !row.is_deleted })}
                      >
                        {row.is_deleted ? 'Restore' : 'Delete'}
                      </Button>
                    </td>
                    <td className="px-3 py-3">
                      <textarea
                        className={`${textareaClass} h-20 text-xs`}
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
                    <td className="px-3 py-3 text-right space-y-2">
                      {row.promoted_idea_id ? (
                        <div className="space-y-1 text-right">
                          <a
                            href={`/ideas/${row.promoted_idea_id}`}
                            className="text-primary underline-offset-4 hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open idea
                          </a>
                          <a
                            href={`/admin/data/ideas?search=${row.promoted_idea_id}`}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            View in admin
                          </a>
                          {row.promoted_at && (
                            <div className="text-[11px] text-muted-foreground">
                              Promoted {row.promoted_at}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="w-full rounded-full"
                          onClick={() => promote(row.id)}
                          disabled={loading || promotingId === row.id}
                        >
                          {promotingId === row.id ? 'Promoting…' : 'Promote to Idea'}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="w-full rounded-full"
                        onClick={() => updateRow(row.id, { admin_note: noteValue })}
                      >
                        Save note
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && !error && (
                <tr>
                  <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={9}>
                    No posts found.
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
            void fetchData(next);
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
            void fetchData(next);
          }}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
