'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { IngestStrategy } from '@/lib/server/adminStrategies';
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
    <tr className="border-t">
      <td className="px-3 py-2 align-top">
        <div className="font-medium text-gray-900">{strategy.name}</div>
        <div className="text-xs text-gray-500">
          {strategy.description || '—'}
        </div>
      </td>
      <td className="px-3 py-2 align-top text-sm text-gray-700">
        {SOURCE_LABELS[strategy.source] ?? strategy.source}
      </td>
      <td className="px-3 py-2 align-top">
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
            strategy.is_active
              ? 'bg-green-50 text-green-700 ring-1 ring-green-100'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {strategy.is_active ? 'Yes' : 'No'}
        </span>
      </td>
      <td className="px-3 py-2 align-top text-sm text-gray-700">
        {strategy.cron_expr || '—'}
      </td>
      <td className="px-3 py-2 align-top text-sm text-gray-700">
        {formatDate(strategy.last_run_at)}
      </td>
      <td className="px-3 py-2 align-top text-sm">
        <span
          className={
            strategy.last_run_status === 'error'
              ? 'text-red-600'
              : 'text-gray-700'
          }
        >
          {strategy.last_run_status || '—'}
        </span>
        {strategy.last_error && (
          <div className="text-xs text-red-600">{strategy.last_error}</div>
        )}
      </td>
      <td className="px-3 py-2 align-top space-y-2 text-right">
        <form action={toggleAction} className="inline">
          <button
            type="submit"
            className="rounded-md border px-2 py-1 text-xs text-gray-800 hover:bg-gray-100"
          >
            {strategy.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setEditOpen((v) => !v)}
          className="rounded-md border px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
        >
          {editOpen ? 'Close' : 'Edit'}
        </button>
        <button
          type="button"
          onClick={runStrategyOnce}
          className="rounded-md border px-2 py-1 text-xs text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={runState.loading}
        >
          {runState.loading ? 'Queuing…' : 'Run now'}
        </button>
        {runState.error && (
          <div className="text-xs text-red-600">{runState.error}</div>
        )}
        {runState.jobId && (
          <div className="text-xs text-gray-700">
            Job queued:{' '}
            <Link
              href={`/admin/jobs/${runState.jobId}`}
              className="text-indigo-600 hover:underline"
            >
              View job
            </Link>{' '}
            or{' '}
            <Link href="/admin/jobs" className="text-indigo-600 hover:underline">
              go to jobs
            </Link>
          </div>
        )}
        {toggleState.error && (
          <div className="text-xs text-red-600">{toggleState.error}</div>
        )}
        {editOpen && (
          <div className="mt-2 rounded-lg border bg-gray-50 p-3 text-left">
            <form action={updateAction} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">
                  Name
                </label>
                <input
                  name="name"
                  defaultValue={strategy.name}
                  className="w-full rounded-md border px-2 py-1 text-sm"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">
                  Source
                </label>
                <select
                  name="source"
                  defaultValue={strategy.source}
                  className="w-full rounded-md border px-2 py-1 text-sm"
                  required
                >
                  <option value="reddit">Reddit</option>
                  <option value="youtube">YouTube</option>
                  <option value="google_trends">Google Trends</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={strategy.description ?? ''}
                  className="w-full rounded-md border px-2 py-1 text-sm"
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
                  className="text-sm text-gray-700"
                >
                  Active
                </label>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">
                  Cron expression
                </label>
                <input
                  name="cron_expr"
                  defaultValue={strategy.cron_expr ?? ''}
                  className="w-full rounded-md border px-2 py-1 text-sm"
                  placeholder="e.g. */10 * * * *"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">
                  Config (JSON)
                </label>
                <textarea
                  name="config"
                  defaultValue={JSON.stringify(strategy.config ?? {}, null, 2)}
                  className="w-full rounded-md border px-2 py-1 text-xs font-mono"
                  rows={6}
                />
                <p className="text-xs text-gray-500">
                  Example:{' '}
                  <code className="rounded bg-gray-100 px-1 py-0.5">
                    {exampleConfig(strategy.source)}
                  </code>
                </p>
              </div>
              {updateState.error && (
                <div className="text-xs text-red-600">{updateState.error}</div>
              )}
              <button
                type="submit"
                className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Save
              </button>
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
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">New strategy</h2>
        <p className="text-sm text-gray-600">
          Add a new ingestion strategy. Config expects JSON.
        </p>
        <form action={createAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Name</label>
            <input
              name="name"
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Source</label>
            <select
              name="source"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="reddit">Reddit</option>
              <option value="youtube">YouTube</option>
              <option value="google_trends">Google Trends</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-semibold text-gray-700">
              Description
            </label>
            <textarea
              name="description"
              className="w-full rounded-md border px-3 py-2 text-sm"
              rows={2}
              placeholder="Optional description"
            />
          </div>
          <div className="flex items-center gap-2 text-sm md:col-span-2">
            <input id="new_is_active" type="checkbox" name="is_active" defaultChecked />
            <label htmlFor="new_is_active" className="text-sm text-gray-700">
              Active
            </label>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-semibold text-gray-700">
              Cron expression
            </label>
            <input
              name="cron_expr"
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. */10 * * * *"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-semibold text-gray-700">
              Config (JSON)
            </label>
            <textarea
              name="config"
              defaultValue={exampleConfig(newSource)}
              className="w-full rounded-md border px-3 py-2 text-xs font-mono"
              rows={6}
            />
            <p className="text-xs text-gray-500">
              Provide JSON config for the selected source. Example shown above.
            </p>
          </div>
          {createState.error && (
            <div className="md:col-span-2 text-sm text-red-600">
              {createState.error}
            </div>
          )}
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Create strategy
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Cron</th>
              <th className="px-3 py-2">Last run</th>
              <th className="px-3 py-2">Last status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((strategy) => (
              <StrategyRow key={strategy.id} strategy={strategy} />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-sm text-gray-500" colSpan={7}>
                  No strategies found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
