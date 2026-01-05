'use client';

import { AdminInput, AdminSelect } from '@/components/admin/primitives';
import { STRATEGY_TRACKS } from '@/lib/strategyTracks';
import { useDraft } from '../_draft/context';
import SummaryCard from '../_components/SummaryCard';
import WizardShell from '../_components/WizardShell';

export default function StrategyStep1Page() {
  const { draft, updateDraft } = useDraft();
  const name = draft.name ?? '';
  const source = draft.source ?? '';
  const track = draft.track ?? '';
  const description = draft.description ?? '';
  const canProceed = Boolean(name.trim()) && Boolean(source);

  return (
    <WizardShell
      title="Create Strategy"
      step={1}
      nextHref="/dashboard/strategies/new/step-2"
      disableBack
      disableNext={!canProceed}
      rightSlot={<SummaryCard />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 text-sm">
          <label className="text-muted-foreground">Name *</label>
          <AdminInput
            value={name}
            onChange={(event) => updateDraft({ name: event.target.value })}
            placeholder="e.g. reddit-finance-opportunities"
          />
        </div>
        <div className="space-y-2 text-sm">
          <label className="text-muted-foreground">Source *</label>
          <AdminSelect
            value={source}
            onChange={(event) =>
              updateDraft({
                source: event.target.value
                  ? (event.target.value as 'reddit' | 'youtube' | 'trends')
                  : undefined,
              })
            }
          >
            <option value="">Select a source</option>
            <option value="reddit">Reddit</option>
            <option value="youtube">YouTube</option>
            <option value="trends">Trends</option>
          </AdminSelect>
        </div>
        <div className="space-y-2 text-sm sm:col-span-2">
          <label className="text-muted-foreground">Track</label>
          <AdminInput
            value={track}
            onChange={(event) =>
              updateDraft({ track: event.target.value || undefined })
            }
            placeholder="Enter or choose a track"
            list="strategy-track-options"
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
          <label className="text-muted-foreground">Description</label>
          <textarea
            value={description}
            onChange={(event) =>
              updateDraft({ description: event.target.value || undefined })
            }
            rows={3}
            placeholder="Optional"
            className="w-full rounded-xl border border-border/50 bg-card/60 px-3 py-2 text-sm text-foreground shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
      </div>
    </WizardShell>
  );
}
