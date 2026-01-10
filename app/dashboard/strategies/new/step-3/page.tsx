'use client';

import { useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { AdminInput, AdminSelect } from '@/components/admin/primitives';
import { useDraft } from '../_draft/context';
import SummaryCard from '../_components/SummaryCard';
import WizardShell from '../_components/WizardShell';

export default function StrategyStep3Page() {
  const { draft, updateDraft } = useDraft();
  const sort = draft.sort ?? 'top';
  const timeRange = draft.timeRange ?? 'day';
  const limit = typeof draft.limit === 'number' ? draft.limit : 25;
  const signals = draft.signals ?? {};
  const minUpvotes = typeof signals.minUpvotes === 'number' ? signals.minUpvotes : 10;
  const minComments = typeof signals.minComments === 'number' ? signals.minComments : 5;
  const maxAgeDays = typeof signals.maxAgeDays === 'number' ? signals.maxAgeDays : 7;
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { backHref, nextHref } = useMemo(() => {
    const mode = searchParams.get('mode') || '';
    const strategyId = searchParams.get('strategyId') || '';
    const isEdit =
      mode === 'edit' || (pathname ? pathname.startsWith('/dashboard/strategies/edit') : false);
    const basePath = isEdit ? '/dashboard/strategies/edit' : '/dashboard/strategies/new';
    const qp = new URLSearchParams();
    if (mode) qp.set('mode', mode);
    if (strategyId) qp.set('strategyId', strategyId);
    const query = qp.toString();
    return {
      backHref: `${basePath}/step-2${query ? `?${query}` : ''}`,
      nextHref: `${basePath}/step-4${query ? `?${query}` : ''}`,
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    updateDraft({
      sort,
      timeRange,
      limit,
      signals: {
        minUpvotes,
        minComments,
        maxAgeDays,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <WizardShell
      title="Create Strategy"
      step={3}
      backHref={backHref}
      nextHref={nextHref}
      rightSlot={<SummaryCard />}
    >
      <div className="space-y-8">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2 text-sm">
            <label className="text-sm font-medium text-muted-foreground">Sort</label>
            <AdminSelect
              value={sort}
              onChange={(event) =>
                updateDraft({ sort: event.target.value as 'top' | 'new' })
              }
              className="h-11 text-base"
            >
              <option value="top">Top</option>
              <option value="new">New</option>
            </AdminSelect>
          </div>
          <div className="space-y-2 text-sm">
            <label className="text-sm font-medium text-muted-foreground">Time range</label>
            <AdminSelect
              value={timeRange}
              onChange={(event) =>
                updateDraft({
                  timeRange: event.target.value as 'day' | 'week' | 'month',
                })
              }
              className="h-11 text-base"
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </AdminSelect>
          </div>
          <div className="space-y-2 text-sm">
            <label className="text-sm font-medium text-muted-foreground">Limit</label>
            <AdminInput
              type="number"
              min={10}
              max={100}
              step={5}
              value={limit}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) {
                  updateDraft({ limit: next });
                }
              }}
              onBlur={() => {
                const clamped = Math.min(100, Math.max(10, limit || 10));
                updateDraft({ limit: clamped });
              }}
              className="h-11 text-base"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border/40 bg-card/60 p-4">
          <div className="text-sm font-semibold text-foreground">Signals</div>
          <div className="text-xs text-muted-foreground">
            Tune thresholds to focus on higher-signal posts.
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2 text-sm">
              <label className="text-sm font-medium text-muted-foreground">Min upvotes</label>
              <AdminInput
                type="number"
                min={0}
                max={5000}
                value={minUpvotes}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) {
                    updateDraft({
                      signals: { ...signals, minUpvotes: next },
                    });
                  }
                }}
                onBlur={() => {
                  const clamped = Math.min(5000, Math.max(0, minUpvotes || 0));
                  updateDraft({
                    signals: { ...signals, minUpvotes: clamped },
                  });
                }}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-2 text-sm">
              <label className="text-sm font-medium text-muted-foreground">Min comments</label>
              <AdminInput
                type="number"
                min={0}
                max={5000}
                value={minComments}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) {
                    updateDraft({
                      signals: { ...signals, minComments: next },
                    });
                  }
                }}
                onBlur={() => {
                  const clamped = Math.min(5000, Math.max(0, minComments || 0));
                  updateDraft({
                    signals: { ...signals, minComments: clamped },
                  });
                }}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-2 text-sm">
              <label className="text-sm font-medium text-muted-foreground">
                Recency (days)
              </label>
              <AdminInput
                type="number"
                min={1}
                max={30}
                value={maxAgeDays}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) {
                    updateDraft({
                      signals: { ...signals, maxAgeDays: next },
                    });
                  }
                }}
                onBlur={() => {
                  const clamped = Math.min(30, Math.max(1, maxAgeDays || 1));
                  updateDraft({
                    signals: { ...signals, maxAgeDays: clamped },
                  });
                }}
                className="h-11 text-base"
              />
            </div>
          </div>
        </div>
      </div>
    </WizardShell>
  );
}
