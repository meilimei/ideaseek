'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminSelect, CardBody, CardHeading, DataTable, GlassCard } from '@/components/admin/primitives';
import RunNowButton from './RunNowButton';
import DeleteStrategyButton from './DeleteStrategyButton';
import { toggleStrategyActive, toggleStrategyVisibility } from './actions';

type StrategyRow = {
  id: string;
  name: string | null;
  source: string | null;
  description: string | null;
  is_active: boolean | null;
  cron_expr: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  last_error: string | null;
  ideas_visibility: string | null;
};

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default function StrategiesClient({ strategies }: { strategies: StrategyRow[] }) {
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const hasFilters =
    query.trim().length > 0 ||
    sourceFilter !== 'all' ||
    statusFilter !== 'all' ||
    visibilityFilter !== 'all';

  const filtered = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return strategies.filter((strategy) => {
      const visibility = strategy.ideas_visibility === 'private' ? 'private' : 'public';
      const source = strategy.source ?? '';
      const status = strategy.is_active ? 'active' : 'inactive';
      if (sourceFilter !== 'all' && source !== sourceFilter) return false;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (visibilityFilter !== 'all' && visibility !== visibilityFilter) return false;
      if (!lowered) return true;
      const haystack = `${strategy.name ?? ''} ${strategy.description ?? ''}`.toLowerCase();
      return haystack.includes(lowered);
    });
  }, [strategies, query, sourceFilter, statusFilter, visibilityFilter]);

  return (
    <GlassCard>
      <CardHeading
        title="Strategy Center"
        description="Manage your ingestion strategies and visibility settings."
      />
      <CardBody className="space-y-4 pt-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-1 flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Search
            </label>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search strategies…"
            />
          </div>
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Source
              </div>
              <AdminSelect
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                <option value="all">All sources</option>
                <option value="reddit">Reddit</option>
                <option value="youtube">YouTube</option>
                <option value="google_trends">Google Trends</option>
              </AdminSelect>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Status
              </div>
              <AdminSelect
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </AdminSelect>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Visibility
              </div>
              <AdminSelect
                value={visibilityFilter}
                onChange={(event) => setVisibilityFilter(event.target.value)}
              >
                <option value="all">All visibility</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </AdminSelect>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtered.length} strategies</span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSourceFilter('all');
                setStatusFilter('all');
                setVisibilityFilter('all');
              }}
              className="text-xs font-medium text-foreground/80 hover:text-foreground"
            >
              Reset filters
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center">
            {strategies.length === 0 ? (
              <>
                <div className="text-sm font-semibold text-foreground">No strategies yet</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Create your first guided strategy to start collecting ideas.
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-foreground">
                  No strategies match your filters
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Try adjusting search or filters to see more results.
                </div>
              </>
            )}
          </div>
        ) : (
          <DataTable>
            <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Strategy</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Visibility</th>
                <th className="px-3 py-2 font-medium">Schedule</th>
                <th className="px-3 py-2 font-medium">Last run</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map((strategy) => {
                const visibility =
                  strategy.ideas_visibility === 'private' ? 'private' : 'public';
                return (
                  <tr key={strategy.id} className="align-top">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-foreground">
                        {strategy.name || 'Untitled strategy'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {strategy.description || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">
                      {strategy.source ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        className={
                          strategy.is_active
                            ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
                            : 'bg-secondary/40 text-muted-foreground border-border/60'
                        }
                      >
                        {strategy.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <form
                        action={toggleStrategyVisibility.bind(
                          null,
                          strategy.id,
                          visibility,
                        )}
                      >
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="rounded-full px-3"
                        >
                          {visibility === 'public' ? 'Public' : 'Private'}
                        </Button>
                      </form>
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">
                      {strategy.cron_expr ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">
                      {formatDate(strategy.last_run_at)}
                      <div className="text-xs text-muted-foreground">
                        {strategy.last_run_status || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end gap-2">
                        <form
                          action={toggleStrategyActive.bind(
                            null,
                            strategy.id,
                            strategy.is_active,
                          )}
                        >
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            className="rounded-full px-3"
                          >
                            {strategy.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </form>
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="rounded-full px-3"
                        >
                          <Link
                            href={`/dashboard/strategies/edit/step-1?mode=edit&strategyId=${strategy.id}`}
                          >
                            Edit
                          </Link>
                        </Button>
                        <RunNowButton strategyId={strategy.id} />
                        <DeleteStrategyButton strategyId={strategy.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </CardBody>
    </GlassCard>
  );
}
