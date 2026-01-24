'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminInput, AdminSelect } from '@/components/admin/primitives';
import { STRATEGY_TRACKS } from '@/lib/strategyTracks';
import { useDraft } from '../_draft/context';
import SummaryCard from '../_components/SummaryCard';
import WizardShell from '../_components/WizardShell';

export default function StrategyStep1Client({
  rightSlot,
}: {
  rightSlot?: ReactNode;
}) {
  const { draft, updateDraft } = useDraft();
  const name = draft.name ?? '';
  const source = draft.source ?? '';
  const track = draft.track ?? '';
  const description = draft.description ?? '';
  const canProceed = Boolean(name.trim()) && Boolean(source);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const nextHref = useMemo(() => {
    const mode = searchParams.get('mode') || '';
    const strategyId = searchParams.get('strategyId') || '';
    const isEdit =
      mode === 'edit' || (pathname ? pathname.startsWith('/dashboard/strategies/edit') : false);
    const basePath = isEdit ? '/dashboard/strategies/edit' : '/dashboard/strategies/new';
    const qp = new URLSearchParams();
    if (mode) qp.set('mode', mode);
    if (strategyId) qp.set('strategyId', strategyId);
    const query = qp.toString();
    return `${basePath}/step-2${query ? `?${query}` : ''}`;
  }, [pathname, searchParams]);

  return (
    <WizardShell
      title="Create Strategy"
      step={1}
      nextHref={nextHref}
      disableBack
      disableNext={!canProceed}
      rightSlot={rightSlot ?? <SummaryCard />}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2 text-sm">
          <label className="text-sm font-medium text-muted-foreground">Name *</label>
          <AdminInput
            value={name}
            onChange={(event) => updateDraft({ name: event.target.value })}
            placeholder="e.g. reddit-finance-opportunities"
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-2 text-sm">
          <label className="text-sm font-medium text-muted-foreground">Source *</label>
          <AdminSelect
            value={source}
            onChange={(event) =>
              updateDraft({
                source: event.target.value
                  ? (event.target.value as 'reddit' | 'youtube' | 'trends')
                  : undefined,
              })
            }
            className="h-11 text-base"
          >
            <option value="">Select a source</option>
            <option value="reddit">Reddit</option>
            <option value="youtube">YouTube</option>
            <option value="trends">Trends</option>
          </AdminSelect>
        </div>
        <div className="space-y-2 text-sm sm:col-span-2">
          <label className="text-sm font-medium text-muted-foreground">Track</label>
          <AdminInput
            value={track}
            onChange={(event) =>
              updateDraft({ track: event.target.value || undefined })
            }
            placeholder="Enter or choose a track"
            list="strategy-track-options"
            className="h-11 text-base"
          />
          <datalist id="strategy-track-options">
            {STRATEGY_TRACKS.map((option) => (
              <option key={option.id} value={option.title} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">
            Type to search or enter your own track.
          </p>
        </div>
        <div className="space-y-2 text-sm sm:col-span-2">
          <label className="text-sm font-medium text-muted-foreground">
            Description <span className="text-xs text-muted-foreground">(optional)</span>
          </label>
          <div className="rounded-2xl border border-border/50 bg-card/60 p-3 shadow-soft">
            <textarea
              value={description}
              onChange={(event) =>
                updateDraft({ description: event.target.value || undefined })
              }
              rows={4}
              placeholder="Share the goal or focus of this strategy."
              className="w-full resize-none bg-transparent text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none"
            />
          </div>
        </div>
      </div>
    </WizardShell>
  );
}
