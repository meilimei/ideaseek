'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useMemo, useState } from 'react';
import type { IngestStrategy } from '@/lib/server/adminStrategies';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, GlassCard, CardBody, CardHeading } from '@/components/admin/primitives';
import {
  createStrategyAction,
  toggleStrategyActiveAction,
  updateStrategyAction,
} from './actions';

type StrategiesClientProps = {
  strategies: IngestStrategy[];
};

const SOURCE_LABELS: Record<string, string> = {
  reddit: 'Reddit',
  youtube: 'YouTube',
  google_trends: 'Google Trends',
};

const inputClass =
  'w-full rounded-xl border border-border/50 bg-card/60 px-3 py-2 text-sm text-foreground shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40';
const textareaClass = `${inputClass} rounded-2xl`;

function exampleConfig(source: string): string {
  switch (source) {
    case 'reddit':
      return JSON.stringify(
        { subreddits: ['Entrepreneur'], minScore: 5, keywords: ['idea'] },
        null,
        2,
      );
    case 'youtube':
      return JSON.stringify(
        { queries: ['ai tools'], regionCode: 'US', minViews: 1000 },
        null,
        2,
      );
    case 'google_trends':
      return JSON.stringify(
        { keywords: ['ai tools'], geo: 'US', timeframe: 'today 12-m' },
        null,
        2,
      );
    default:
      return '{}';
  }
}

function formatDate(value: string | Date | null): string {
  if (!value) return 'Never';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function StrategyRow({ strategy }: { strategy: IngestStrategy }) {
  const [editOpen, setEditOpen] = useState(false);
  const initial = { error: undefined, success: false };
  const [updateState, updateAction] = useActionState(
    updateStrategyAction.bind(null, strategy.id),
    initial,
  );
  const [toggleState, toggleAction] = useActionState(
    toggleStrategyActiveAction.bind(null, strategy.id),
    initial,
  );
  const router = useRouter();
  const [runState, setRunState] = useState<{
    loading: boolean;
    error: string | null;
    jobId: string | null;
  }>({ loading: false, error: null, jobId: null });

  const runStrategyOnce = async () => {
    setRunState({ loading: true, error: null, jobId: null });
    try {
      const res = await fetch(`/api/admin/strategies/${strategy.id}/run`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to create job');
      }
      setRunState({ loading: false, error: null, jobId: json.jobId ?? null });
      if (json.jobId) {
        router.prefetch(`/admin/jobs/${json.jobId}`);
      }
    } catch (err) {
      setRunState({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
        jobId: null,
      });
    }
  };

  return (
    <tr className="align-top transition hover:bg-secondary/8">
      <td className="px-3 py-3">
        <div className="font-semibold text-foreground">{strategy.name}</div>
        <div className="text-xs text-muted-foreground">
          {strategy.description || '—'}
        </div>
      </td>
      <td className="px-3 py-3 align-top text-sm text-muted-foreground">
        {SOURCE_LABELS[strategy.source] ?? strategy.source}
      </td>
      <td className="px-3 py-3 align-top">
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
      <td className="px-3 py-3 align-top text-sm text-muted-foreground">
        {strategy.cron_expr || '—'}
      </td>
      <td className="px-3 py-3 align-top text-sm text-muted-foreground">
        {formatDate(strategy.last_run_at)}
      </td>
      <td className="px-3 py-3 align-top text-sm">
        <span
          className={
            strategy.last_run_status === 'error'
              ? 'text-destructive'
              : 'text-foreground'
          }
        >
          {strategy.last_run_status || '—'}
        </span>
        {strategy.last_error && (
          <div className="text-xs text-destructive">{strategy.last_error}</div>
        )}
      </td>
      <td className="px-3 py-3 align-top space-y-2 text-right">
        <form action={toggleAction} className="inline">
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
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-full px-3 text-primary"
          onClick={() => setEditOpen((v) => !v)}
        >
          {editOpen ? 'Close' : 'Edit'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="rounded-full px-3"
          onClick={runStrategyOnce}
          disabled={runState.loading}
        >
          {runState.loading ? 'Queuing…' : 'Run now'}
        </Button>
        {runState.error && (
          <div className="text-xs text-destructive">{runState.error}</div>
        )}
        {runState.jobId && (
          <div className="text-xs text-muted-foreground">
            Job queued:{' '}
            <Link
              href={`/admin/jobs/${runState.jobId}`}
              className="text-primary hover:underline"
            >
              View job
            </Link>{' '}
            or{' '}
            <Link href="/admin/jobs" className="text-primary hover:underline">
              go to jobs
            </Link>
          </div>
        )}
        {toggleState.error && (
          <div className="text-xs text-destructive">{toggleState.error}</div>
        )}
        {editOpen && (
          <div className="mt-2 rounded-2xl border border-border/50 bg-card/70 p-4 text-left shadow-soft">
            <form action={updateAction} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Name
                </label>
                <input
                  name="name"
                  defaultValue={strategy.name}
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Source
                </label>
                <select
                  name="source"
                  defaultValue={strategy.source}
                  className={inputClass}
                  required
                >
                  <option value="reddit">Reddit</option>
                  <option value="youtube">YouTube</option>
                  <option value="google_trends">Google Trends</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={strategy.description ?? ''}
                  className={textareaClass}
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <input
                  id={`is_active_${strategy.id}`}
                  type="checkbox"
                  name="is_active"
                  defaultChecked={strategy.is_active}
                />
                <label
                  htmlFor={`is_active_${strategy.id}`}
                  className="text-sm text-foreground/80"
                >
                  Active
                </label>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Cron expression
                </label>
                <input
                  name="cron_expr"
                  defaultValue={strategy.cron_expr ?? ''}
                  className={inputClass}
                  placeholder="e.g. */10 * * * *"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Config (JSON)
                </label>
                <textarea
                  name="config"
                  defaultValue={JSON.stringify(strategy.config ?? {}, null, 2)}
                  className={`${textareaClass} font-mono text-xs`}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Example:{' '}
                  <code className="rounded bg-secondary/30 px-1 py-0.5">
                    {exampleConfig(strategy.source)}
                  </code>
                </p>
              </div>
              {updateState.error && (
                <div className="text-xs text-destructive">{updateState.error}</div>
              )}
              <Button type="submit" size="sm">
                Save
              </Button>
            </form>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function StrategiesClient({ strategies }: StrategiesClientProps) {
  const initial = { error: undefined, success: false };
  const [createState, createAction] = useActionState(createStrategyAction, initial);
  const [newSource, setNewSource] = useState<string>('reddit');

  const sorted = useMemo(
    () => [...strategies].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [strategies],
  );

  return (
    <div className="space-y-6">
      <GlassCard>
        <CardHeading
          title="New strategy"
          description="Add a new ingestion strategy. Config expects JSON."
        />
        <CardBody className="pt-0">
          <form action={createAction} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Name</label>
              <input
                name="name"
                className={inputClass}
                required
                placeholder="e.g. r/Entrepreneur scraping"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Source</label>
              <select
                name="source"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                className={inputClass}
              >
                <option value="reddit">Reddit</option>
                <option value="youtube">YouTube</option>
                <option value="google_trends">Google Trends</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Description
              </label>
              <textarea
                name="description"
                className={textareaClass}
                rows={2}
                placeholder="Optional description"
              />
            </div>
            <div className="flex items-center gap-2 text-sm md:col-span-2">
              <input id="new_is_active" type="checkbox" name="is_active" defaultChecked />
              <label htmlFor="new_is_active" className="text-sm text-foreground/80">
                Active
              </label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Cron expression
              </label>
              <input
                name="cron_expr"
                className={inputClass}
                placeholder="e.g. */10 * * * *"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Config (JSON)</span>
                <span className="text-[11px] text-muted-foreground/80">
                  Example updates when source changes
                </span>
              </label>
              <textarea
                name="config"
                defaultValue={exampleConfig(newSource)}
                className={`${textareaClass} font-mono text-xs`}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Provide JSON config for the selected source. Example shown above.
              </p>
            </div>
            {createState.error && (
              <div className="md:col-span-2 text-sm text-destructive">
                {createState.error}
              </div>
            )}
            <div className="md:col-span-2">
              <Button type="submit" size="sm">
                Create strategy
              </Button>
            </div>
          </form>
        </CardBody>
      </GlassCard>

      <GlassCard>
        <CardHeading
          title="Existing strategies"
          description="Manage schedules and run ad-hoc ingests."
        />
        <CardBody className="overflow-x-auto pt-0">
          <DataTable>
            <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Active</th>
                <th className="px-3 py-2 font-medium">Cron</th>
                <th className="px-3 py-2 font-medium">Last run</th>
                <th className="px-3 py-2 font-medium">Last status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {sorted.map((strategy) => (
                <StrategyRow key={strategy.id} strategy={strategy} />
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={7}>
                    No strategies found.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </CardBody>
      </GlassCard>
    </div>
  );
}
